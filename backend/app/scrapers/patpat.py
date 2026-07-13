from datetime import datetime
from app.utils.time import utc_now
import re
from urllib.parse import urljoin

import httpx
import structlog
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.scrapers.cleaner import CarCleaner
from db.models import CarListing

log = structlog.get_logger()


class PatpatScraper:
    SOURCE = "patpat"
    BASE_URL = "https://patpat.lk/en/sri-lanka/vehicle/car"

    def __init__(self, db: Session):
        self.db = db
        self.cleaner = CarCleaner()

    def _upsert_listing(self, payload: dict):
        existing = (
            self.db.query(CarListing)
            .filter(
                CarListing.source == self.SOURCE,
                CarListing.source_id == payload["source_id"],
            )
            .first()
        )

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
            existing.last_seen_at = utc_now()
            return False

        self.db.add(CarListing(**payload))
        return True

    @staticmethod
    def _text(node, selectors: list[str]) -> str:
        for selector in selectors:
            elem = node.select_one(selector)
            if elem:
                text = elem.get_text(" ", strip=True)
                if text:
                    return text
        return ""

    @staticmethod
    def _attr(node, selectors: list[tuple[str, str]]) -> str:
        for selector, attr in selectors:
            elem = node.select_one(selector)
            if elem and elem.has_attr(attr):
                value = str(elem.get(attr) or "").strip()
                if value:
                    return value
        return ""

    @staticmethod
    def _extract_max_page(soup: BeautifulSoup) -> int | None:
        max_page = 0

        for link in soup.select(".pagination a[href*='page=']"):
            href = str(link.get("href") or "")
            match = re.search(r"[?&]page=(\d+)", href)
            if match:
                max_page = max(max_page, int(match.group(1)))

        page_summary = soup.get_text(" ", strip=True)
        summary_match = re.search(r"Page\s+\d+\s+of\s+(\d+)", page_summary, flags=re.IGNORECASE)
        if summary_match:
            max_page = max(max_page, int(summary_match.group(1)))

        return max_page if max_page > 0 else None

    def _extract_price_text(self, card: BeautifulSoup) -> str:
        for selector in (
            "span[class*='text-2xl'][class*='font-semibold']",
            "[class*='price']",
        ):
            elem = card.select_one(selector)
            if elem:
                text = elem.get_text(" ", strip=True)
                if text:
                    return text

        card_text = card.get_text(" ", strip=True)
        match = re.search(
            r"(?:Rs\.?|LKR|Rs:)\s*([0-9][0-9,]*(?:\.[0-9]+)?)",
            card_text,
            flags=re.IGNORECASE,
        )
        # Keep the currency marker so price normalization can parse grouped values (e.g. Rs: 10,500,000).
        return match.group(0) if match else ""

    @staticmethod
    def _extract_district(card_text: str) -> str:
        match = re.search(
            r"\|\s*([A-Za-z][A-Za-z\s\-]+?)\s*(?:[0-9][0-9,]*\s*km|km\b|$)",
            card_text,
            flags=re.IGNORECASE,
        )
        if not match:
            return ""
        return match.group(1).strip()

    async def scrape(self, max_pages: int = 5):
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }

        page_limit = max_pages if max_pages > 0 else None
        page_num = 1
        seen_urls: set[str] = set()
        consecutive_empty_pages = 0
        consecutive_page_errors = 0

        async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
            while True:
                if page_limit is not None and page_num > page_limit:
                    break

                url = self.BASE_URL if page_num == 1 else f"{self.BASE_URL}?page={page_num}"
                log.info("scraping_page", source=self.SOURCE, page=page_num)

                try:
                    res = await client.get(url, timeout=30)
                    res.raise_for_status()
                    soup = BeautifulSoup(res.text, "lxml")

                    cards = soup.select("div.listing-card")
                    if not cards:
                        cards = soup.select("li.card-item")

                    if not cards:
                        consecutive_empty_pages += 1
                        log.info(
                            "patpat_no_cards",
                            page=page_num,
                            consecutive_empty_pages=consecutive_empty_pages,
                        )
                        if consecutive_empty_pages >= 10:
                            break
                        page_num += 1
                        continue

                    max_page_hint = self._extract_max_page(soup)
                    new_on_page = 0

                    for card in cards:
                        try:
                            link = card.select_one("a[href*='/en/ad/vehicle/']")
                            if not link:
                                continue

                            listing_url = str(link.get("href") or "").strip()
                            if not listing_url:
                                continue

                            listing_url = urljoin("https://patpat.lk", listing_url)
                            if listing_url in seen_urls:
                                continue

                            seen_urls.add(listing_url)
                            new_on_page += 1

                            title = self._text(card, [".line-clamp-2", "h2", "h3"])
                            if not title:
                                title = str(link.get("title") or "").strip()
                            if not title:
                                title = link.get_text(" ", strip=True)
                            if not title:
                                continue

                            raw_price = self._extract_price_text(card)
                            card_text = card.get_text(" ", strip=True)
                            district = self._extract_district(card_text)

                            img = card.select_one("img[src]") or card.select_one("img[data-src]")
                            thumb_url = (
                                str(img.get("src") or img.get("data-src") or "").strip() if img else ""
                            )
                            thumb_url = urljoin("https://patpat.lk", thumb_url) if thumb_url else ""

                            data = self.cleaner.clean_title(title)
                            price = self.cleaner.normalize_price_lkr(raw_price)
                            if not data["make"] or not price:
                                continue

                            payload = {
                                "source_id": listing_url,
                                "source": self.SOURCE,
                                "title": title,
                                "make": data["make"],
                                "model": data["model"] or "Other",
                                "year": data["year"],
                                "price_lkr": price,
                                "url": listing_url,
                                "thumbnail_url": thumb_url,
                                "district": district or "Sri Lanka",
                                "condition": None, "_text_blobs": card_text,
                                "scraped_at": utc_now(),
                            }

                            normalized_payload = self.cleaner.normalize_listing_payload(payload)
                            if not normalized_payload:
                                continue

                            self._upsert_listing(normalized_payload)
                            self.db.commit()
                        except Exception as e:
                            log.error("patpat_item_error", error=str(e))
                            self.db.rollback()

                    if new_on_page == 0:
                        consecutive_empty_pages += 1
                        log.info(
                            "patpat_empty_page",
                            page=page_num,
                            consecutive_empty_pages=consecutive_empty_pages,
                        )
                        if consecutive_empty_pages >= 10:
                            break
                        page_num += 1
                        continue

                    consecutive_empty_pages = 0
                    if page_limit is not None and page_num >= page_limit:
                        break

                    if page_limit is None and max_page_hint is not None and page_num >= max_page_hint:
                        break

                    page_num += 1
                    consecutive_page_errors = 0
                except Exception as e:
                    log.error("patpat_page_error", page=page_num, error=str(e))
                    consecutive_page_errors += 1
                    if consecutive_page_errors >= 25:
                        break
                    page_num += 1

