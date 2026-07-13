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


class AutoLankaSiteScraper:
    SOURCE = "auto-lanka"
    BASE_URL = "https://auto-lanka.com/Default.aspx?type=Cars&page="

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

    def _build_page_url(self, page_num: int) -> str:
        return f"{self.BASE_URL}{page_num + 1}"

    @staticmethod
    def _is_vehicle_schema_node(node) -> bool:
        schema_text = node.get_text(" ", strip=True)
        return bool(
            schema_text
            and "/forsale/" in schema_text
            and re.search(r'"@type"\s*:\s*"Vehicle"', schema_text, flags=re.IGNORECASE)
        )

    @staticmethod
    def _district_from_url(listing_url: str) -> str:
        match = re.search(r"cars-for-sale-in-([^/]+)/", listing_url, flags=re.IGNORECASE)
        if not match:
            return ""
        return re.sub(r"[-_]+", " ", match.group(1)).strip().title()

    async def scrape(self, max_pages: int = 5):
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
            consecutive_empty_pages = 0
            consecutive_page_errors = 0
            seen_urls: set[str] = set()
            for page_num in range(1, max_pages + 1):
                url = self._build_page_url(page_num)
                log.info("scraping_page", source=self.SOURCE, page=page_num)

                try:
                    res = await client.get(url, timeout=30)
                    res.raise_for_status()
                    soup = BeautifulSoup(res.text, "lxml")
                    cards = soup.select("div.avdt-item.row")
                    if not cards:
                        cards = [
                            node
                            for node in soup.select("script[type='application/ld+json']")
                            if self._is_vehicle_schema_node(node)
                        ]
                    if not cards:
                        consecutive_empty_pages += 1
                        log.info(
                            "auto_lanka_no_cards",
                            page=page_num,
                            consecutive_empty_pages=consecutive_empty_pages,
                        )
                        if consecutive_empty_pages >= 10:
                            break
                        continue

                    consecutive_empty_pages = 0
                    consecutive_page_errors = 0

                    for card in cards:
                        try:
                            schema_text = ""
                            if getattr(card, "name", "").lower() == "script":
                                schema_node = card
                            else:
                                schema_node = card.select_one("script[type='application/ld+json']")
                            if schema_node:
                                schema_text = schema_node.get_text(" ", strip=True)

                            url_match = re.search(
                                r'"url"\s*:\s*"([^"]+)"',
                                schema_text,
                                flags=re.IGNORECASE,
                            )
                            listing_url = url_match.group(1).strip() if url_match else ""
                            if not listing_url:
                                # Fallback if schema URL is missing in card JSON-LD.
                                fallback_match = re.search(
                                    r"(/forsale/[^\"'\s]+\.htm)",
                                    str(card),
                                    flags=re.IGNORECASE,
                                )
                                listing_url = fallback_match.group(1).strip() if fallback_match else ""
                            if not listing_url:
                                continue

                            listing_url = urljoin("https://auto-lanka.com", listing_url)
                            if listing_url in seen_urls:
                                continue
                            seen_urls.add(listing_url)

                            title_match = re.search(
                                r'"name"\s*:\s*"([^"]+)"',
                                schema_text,
                                flags=re.IGNORECASE,
                            )
                            title = title_match.group(1).strip() if title_match else ""
                            if not title:
                                title = self._text(card, [".item-title"])
                            if not title:
                                continue

                            price_match = re.search(
                                r'"price"\s*:\s*"([^"]+)"',
                                schema_text,
                                flags=re.IGNORECASE,
                            )
                            card_text = card.get_text(" ", strip=True)
                            raw_price = price_match.group(1).strip() if price_match else ""
                            if not raw_price:
                                raw_price = self._text(card, [".item-price"])

                            district = ""
                            district_match = re.search(
                                r"Location:\s*(.+?)(?:\s+Fuel\s*:|$)",
                                card_text,
                                flags=re.IGNORECASE,
                            )
                            if district_match:
                                district = district_match.group(1).strip()
                            if "," in district:
                                district = district.split(",")[-1].strip()
                            if not district:
                                district = self._district_from_url(listing_url)

                            image_match = re.search(
                                r'"image"\s*:\s*"([^"]+)"',
                                schema_text,
                                flags=re.IGNORECASE,
                            )
                            thumb_url = image_match.group(1).strip() if image_match else ""
                            if not thumb_url:
                                img = card.find("img")
                                thumb_url = str(img.get("src") or "").strip() if img else ""
                            thumb_url = urljoin("https://auto-lanka.com", thumb_url) if thumb_url else ""

                            data = self.cleaner.clean_title(title)
                            price = self.cleaner.clean_price(raw_price)
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
                                "condition": None, "_text_blobs": title,
                                "scraped_at": utc_now(),
                            }
                            normalized_payload = self.cleaner.normalize_listing_payload(payload)
                            if not normalized_payload:
                                continue
                            self._upsert_listing(normalized_payload)
                            self.db.commit()
                        except Exception as e:
                            log.error("auto_lanka_item_error", error=str(e))
                            self.db.rollback()
                except Exception as e:
                    log.error("auto_lanka_page_error", page=page_num, error=str(e))
                    consecutive_page_errors += 1
                    if consecutive_page_errors >= 25:
                        break

