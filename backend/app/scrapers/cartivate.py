from __future__ import annotations

import re
from urllib.parse import urljoin

import httpx
import structlog
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.scrapers.cleaner import CarCleaner
from app.utils.listing_upsert import upsert_listing
from app.utils.time import utc_now

log = structlog.get_logger()

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class CartivateScraper:
    SOURCE = "cartivate"
    BASE_URL = "https://cartivatemotors.lk/listing/"

    def __init__(self, db: Session):
        self.db = db
        self.cleaner = CarCleaner()

    def _upsert_listing(self, payload: dict):
        return upsert_listing(self.db, self.SOURCE, payload)

    @staticmethod
    def _page_url(page_num: int) -> str:
        if page_num <= 1:
            return CartivateScraper.BASE_URL
        return f"{CartivateScraper.BASE_URL}?paged={page_num}"

    @staticmethod
    def _extract_max_page(soup: BeautifulSoup) -> int | None:
        max_page = 0
        for link in soup.select("a[href*='paged='], .pagination a, a.page-numbers"):
            href = str(link.get("href") or "")
            match = re.search(r"[?&]paged=(\d+)", href)
            if match:
                max_page = max(max_page, int(match.group(1)))
            else:
                text = link.get_text(" ", strip=True)
                if text.isdigit():
                    max_page = max(max_page, int(text))
        return max_page if max_page > 0 else None

    @staticmethod
    def _extract_thumbnail(card: BeautifulSoup) -> str:
        featured = card.select_one(".featured-property[data-image], [data-image]")
        if featured:
            candidate = str(featured.get("data-image") or "").strip()
            if candidate:
                return urljoin("https://cartivatemotors.lk", candidate)

        img = card.select_one("img[data-src], img[src]")
        if not img:
            return ""
        candidate = str(img.get("data-src") or img.get("src") or "").strip()
        if not candidate or candidate.startswith("data:"):
            return ""
        return urljoin("https://cartivatemotors.lk", candidate)

    @staticmethod
    def _extract_mileage(card_text: str) -> int | None:
        match = re.search(
            r"Mileage\s*([0-9][0-9,]*)\s*(?:km|kms)?",
            card_text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        digits = re.sub(r"\D", "", match.group(1))
        if not digits:
            return None
        value = int(digits)
        # Brand-new stock often shows mileage 0; keep it.
        return value if value >= 0 else None

    def _build_payload_from_card(self, card: BeautifulSoup) -> dict | None:
        link = card.select_one(
            "h3.tfcl-listing-title a[href*='/listing/'], a[href*='/listing/'][title]"
        )
        if not link:
            return None

        listing_url = urljoin("https://cartivatemotors.lk", str(link.get("href") or "").strip())
        if not listing_url or listing_url.rstrip("/").endswith("/listing"):
            return None

        title = str(link.get("title") or "").strip()
        if not title:
            title = link.get_text(" ", strip=True)
        if not title:
            featured = card.select_one("[title]")
            title = str(featured.get("title") or "").strip() if featured else ""
        if not title:
            return None

        price_node = card.select_one(".sale_price, .price .inner, .price")
        raw_price = price_node.get_text(" ", strip=True) if price_node else ""
        if not raw_price:
            featured = card.select_one("[data-price]")
            raw_price = str(featured.get("data-price") or "").strip() if featured else ""

        card_text = card.get_text(" ", strip=True)
        data = self.cleaner.clean_title(title)
        price = self.cleaner.normalize_price_lkr(raw_price)
        if not data["make"] or not price:
            return None

        payload = {
            "source_id": listing_url,
            "source": self.SOURCE,
            "title": title,
            "make": data["make"],
            "model": data["model"] or "Other",
            "year": data["year"],
            "price_lkr": price,
            "url": listing_url,
            "thumbnail_url": self._extract_thumbnail(card),
            "mileage": self._extract_mileage(card_text),
            "district": "Colombo",
            "condition": None,
            "_text_blobs": card_text,
            "scraped_at": utc_now(),
        }
        return self.cleaner.normalize_listing_payload(payload)

    async def scrape(self, max_pages: int = 5):
        page_limit = max_pages if max_pages > 0 else None
        page_num = 1
        seen_urls: set[str] = set()
        consecutive_empty_pages = 0
        consecutive_page_errors = 0

        async with httpx.AsyncClient(headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            while True:
                if page_limit is not None and page_num > page_limit:
                    break

                url = self._page_url(page_num)
                log.info("scraping_page", source=self.SOURCE, page=page_num)

                try:
                    response = await client.get(url, timeout=40)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, "lxml")
                    cards = soup.select("div.tfcl-listing-card")
                    if not cards:
                        cards = soup.select("div.listing-item")

                    if not cards:
                        consecutive_empty_pages += 1
                        log.info(
                            "cartivate_no_cards",
                            page=page_num,
                            consecutive_empty_pages=consecutive_empty_pages,
                        )
                        if consecutive_empty_pages >= 5:
                            break
                        page_num += 1
                        continue

                    max_page_hint = self._extract_max_page(soup)
                    new_on_page = 0

                    for card in cards:
                        try:
                            payload = self._build_payload_from_card(card)
                            if not payload:
                                continue
                            listing_url = str(payload.get("url") or "")
                            if not listing_url or listing_url in seen_urls:
                                continue
                            seen_urls.add(listing_url)
                            new_on_page += 1
                            self._upsert_listing(payload)
                            self.db.commit()
                        except Exception as exc:
                            log.error("cartivate_item_error", error=str(exc))
                            self.db.rollback()

                    if new_on_page == 0:
                        consecutive_empty_pages += 1
                        if consecutive_empty_pages >= 5:
                            break
                        page_num += 1
                        continue

                    consecutive_empty_pages = 0
                    consecutive_page_errors = 0
                    if page_limit is not None and page_num >= page_limit:
                        break
                    if page_limit is None and max_page_hint is not None and page_num >= max_page_hint:
                        break
                    page_num += 1
                except Exception as exc:
                    log.error("cartivate_page_error", page=page_num, error=str(exc))
                    consecutive_page_errors += 1
                    if consecutive_page_errors >= 25:
                        break
                    page_num += 1
