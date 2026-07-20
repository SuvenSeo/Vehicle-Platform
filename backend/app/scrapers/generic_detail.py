from __future__ import annotations

from datetime import datetime
from app.utils.time import utc_now
import re
from urllib.parse import urljoin, urlparse

import httpx
import structlog
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.scrapers.cleaner import CarCleaner
from app.utils.listing_upsert import upsert_listing

log = structlog.get_logger()

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

SRI_LANKA_DISTRICTS = (
    "Ampara",
    "Anuradhapura",
    "Badulla",
    "Batticaloa",
    "Colombo",
    "Galle",
    "Gampaha",
    "Hambantota",
    "Jaffna",
    "Kalutara",
    "Kandy",
    "Kegalle",
    "Kilinochchi",
    "Kurunegala",
    "Mannar",
    "Matale",
    "Matara",
    "Monaragala",
    "Mullaitivu",
    "Nuwara Eliya",
    "Polonnaruwa",
    "Puttalam",
    "Ratnapura",
    "Trincomalee",
    "Vavuniya",
)


class GenericDetailScraper:
    SOURCE = ""
    BASE_URL = ""
    START_URLS: tuple[str, ...] = ()
    EMPTY_PAGE_LIMIT = 3
    ALLOW_UNAVAILABLE_PRICE = False

    def __init__(self, db: Session):
        self.db = db
        self.cleaner = CarCleaner()

    def _upsert_listing(self, payload: dict):
        return upsert_listing(self.db, self.SOURCE, payload)

    @staticmethod
    def _absolute_url(base_url: str, href: str) -> str:
        return urljoin(base_url, str(href or "").strip())

    @staticmethod
    def _text(node, selectors: tuple[str, ...] | list[str]) -> str:
        for selector in selectors:
            elem = node.select_one(selector)
            if elem:
                text = elem.get_text(" ", strip=True)
                if text:
                    return text
        return ""

    @staticmethod
    def _attr(node, selectors: tuple[tuple[str, str], ...] | list[tuple[str, str]]) -> str:
        for selector, attr in selectors:
            elem = node.select_one(selector)
            if elem and elem.has_attr(attr):
                value = str(elem.get(attr) or "").strip()
                if value:
                    return value
        return ""

    @staticmethod
    def _visible_text(soup: BeautifulSoup) -> str:
        clone = BeautifulSoup(str(soup), "lxml")
        for tag in clone(["script", "style", "noscript"]):
            tag.extract()
        return re.sub(r"\s+", " ", clone.get_text(" ", strip=True)).strip()

    @staticmethod
    def _dedupe_keep_order(values: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for value in values:
            item = str(value or "").strip()
            if not item or item in seen:
                continue
            seen.add(item)
            ordered.append(item)
        return ordered

    @classmethod
    def _extract_listing_links(cls, soup: BeautifulSoup) -> list[str]:
        raise NotImplementedError

    def _build_page_urls(self, max_pages: int) -> list[str]:
        page_limit = max(1, int(max_pages or 1))
        urls: list[str] = []
        starts = self.START_URLS or (self.BASE_URL,)
        for start_url in starts:
            urls.append(start_url)
            for page_num in range(2, page_limit + 1):
                urls.append(f"{start_url.rstrip('/')}?page={page_num}")
        return urls[: page_limit * len(starts)]

    def _extract_title(self, soup: BeautifulSoup) -> str:
        title = self._attr(
            soup,
            (
                ("meta[property='og:title']", "content"),
                ("meta[name='twitter:title']", "content"),
            ),
        )
        if title:
            return title

        title = self._text(
            soup,
            (
                "h1.product_title",
                "h1.entry-title",
                "h1",
                ".ad-title",
                ".listing-title",
                ".title",
                "h2",
            ),
        )
        if title:
            return title

        page_title = self._text(soup, ("title",))
        return re.sub(r"\s*[-|]\s*(AutoLens|Carshop|SaleMe|Riyahub|Cars at DIMO).*$", "", page_title).strip()

    @staticmethod
    def _is_unavailable_price_text(value: str) -> bool:
        text = re.sub(r"\s+", " ", str(value or "")).strip().lower()
        if not text:
            return False
        return bool(
            re.search(
                r"\b(price\s*[:\-]?\s*)?(negotiable|price\s+on\s+request|contact\s+for\s+price|call\s+for\s+price|call\s+for\s+details|poa)\b",
                text,
                flags=re.IGNORECASE,
            )
        )

    def _extract_price_text(self, soup: BeautifulSoup, visible_text: str) -> str:
        for selector, attr in (
            ("meta[property='product:price:amount']", "content"),
            ("meta[itemprop='price']", "content"),
            ("meta[name='product:price:amount']", "content"),
        ):
            node = soup.select_one(selector)
            if node and node.has_attr(attr):
                value = str(node.get(attr) or "").strip()
                if self.cleaner.normalize_price_lkr(value) is not None:
                    return value

        for selector in (
            ".woocommerce-Price-amount",
            ".amount",
            ".price",
            ".ad-price",
            ".listing-price",
            "[class*='price']",
            "[id*='price']",
        ):
            for node in soup.select(selector):
                text = node.get_text(" ", strip=True)
                if self.cleaner.normalize_price_lkr(text) is not None:
                    return text
                if self._is_unavailable_price_text(text):
                    return text

        for pattern in (
            r"(?:Rs\.?|LKR)\s*[:\-]?\s*[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?",
            r"(?:Rs\.?|LKR)\s*[:\-]?\s*[0-9]+(?:\.[0-9]+)?\s*(?:million|mn|m)\b",
        ):
            match = re.search(pattern, visible_text, flags=re.IGNORECASE)
            if match and self.cleaner.normalize_price_lkr(match.group(0)) is not None:
                return match.group(0)

        unavailable_match = re.search(
            r"\bprice\s*[:\-]?\s*(negotiable|price\s+on\s+request|contact\s+for\s+price|call\s+for\s+price)\b",
            visible_text,
            flags=re.IGNORECASE,
        )
        if unavailable_match:
            return unavailable_match.group(0)

        return ""

    def _extract_thumbnail(self, soup: BeautifulSoup, detail_url: str) -> str:
        candidate = self._attr(
            soup,
            (
                ("meta[property='og:image']", "content"),
                ("meta[name='twitter:image']", "content"),
                ("meta[property='og:image:url']", "content"),
                ("img[data-src]", "data-src"),
                ("img[data-lazy-src]", "data-lazy-src"),
                ("img[src]", "src"),
            ),
        )
        if not candidate:
            return ""
        return urljoin(detail_url, candidate)

    @staticmethod
    def _extract_district_from_text(text: str) -> str:
        for district in SRI_LANKA_DISTRICTS:
            if re.search(rf"\b{re.escape(district)}\b", text, flags=re.IGNORECASE):
                return district
        return ""

    @staticmethod
    def _extract_district_from_url(url: str) -> str:
        path = urlparse(url).path.lower()
        slug = re.sub(r"[-_]+", " ", path)
        return GenericDetailScraper._extract_district_from_text(slug)

    @staticmethod
    def _extract_mileage(text: str) -> int | None:
        match = re.search(r"([0-9][0-9,]{2,})\s*(?:km|kms|kilometers)\b", text, flags=re.IGNORECASE)
        if not match:
            return None
        digits = re.sub(r"\D", "", match.group(1))
        return int(digits) if digits else None

    @staticmethod
    def _extract_engine_capacity(text: str) -> int | None:
        match = re.search(r"\b([1-9][0-9]{2,4})\s*(?:cc|c\.c\.|engine)\b", text, flags=re.IGNORECASE)
        if not match:
            return None
        try:
            value = int(match.group(1))
        except ValueError:
            return None
        return value if 300 <= value <= 10000 else None

    @staticmethod
    def _clean_mercedes_model(data: dict, title: str) -> dict:
        if not str(data.get("make") or "").lower().startswith("mercedes"):
            return data
        if str(data.get("model") or "").lower() != "benz":
            return data

        match = re.search(r"\bmercedes(?:[-\s]+benz)?\s+([a-z0-9][a-z0-9-]*)", title, flags=re.IGNORECASE)
        if match:
            data = dict(data)
            data["model"] = match.group(1).title()
        return data

    def _build_payload(self, detail_url: str, html: str, *, vehicle_category: str | None = None) -> dict | None:
        soup = BeautifulSoup(html, "lxml")
        visible_text = self._visible_text(soup)
        title = self._extract_title(soup)
        if not title:
            return None

        data = self._clean_mercedes_model(self.cleaner.clean_title(title), title)
        raw_price = self._extract_price_text(soup, visible_text)
        price = self.cleaner.normalize_price_lkr(raw_price)
        has_unavailable_price = self.ALLOW_UNAVAILABLE_PRICE and self._is_unavailable_price_text(
            raw_price or visible_text
        )
        if not data["make"] or (price is None and not has_unavailable_price):
            return None

        district = self._extract_district_from_text(visible_text) or self._extract_district_from_url(detail_url)
        payload = {
            "source_id": detail_url,
            "source": self.SOURCE,
            "title": title,
            "make": data["make"],
            "model": data["model"] or "Other",
            "year": data["year"],
            "price_lkr": price,
            "url": detail_url,
            "thumbnail_url": self._extract_thumbnail(soup, detail_url),
            "mileage": self._extract_mileage(visible_text),
            "engine_capacity": self._extract_engine_capacity(visible_text),
            "district": district or "Sri Lanka",
            "vehicle_category": vehicle_category or "cars",
            "_text_blobs": visible_text,
            "_allow_missing_price": has_unavailable_price,
            "scraped_at": utc_now(),
        }
        return self.cleaner.normalize_listing_payload(payload)

    @staticmethod
    def _category_from_page_url(page_url: str) -> str:
        path = str(urlparse(page_url).path or "").lower()
        if "vans,-buses" in path or "vans-buses" in path:
            return "vans"
        if "motorbikes" in path:
            return "motorbikes"
        for token in (
            "motorcycles",
            "three-wheels",
            "three-wheelers",
            "vans",
            "buses",
            "lorries",
            "trucks",
            "tractors",
            "heavy-duties",
            "heavy-duty",
            "bicycles",
            "push-cycles",
            "boats",
            "suvs",
            "wagons",
            "pickups",
            "crew-cabs",
            "sports",
            "others",
            "cars",
        ):
            if f"/{token}" in path or path.rstrip("/").endswith(token):
                if token == "motorcycles":
                    return "motorbikes"
                if token == "three-wheels":
                    return "three-wheelers"
                if token == "heavy-duties":
                    return "heavy-duty"
                if token == "push-cycles":
                    return "bicycles"
                return token
        return "cars"

    async def scrape(self, max_pages: int = 5):
        if max_pages <= 0:
            return

        seen_urls: set[str] = set()
        consecutive_empty_pages = 0

        async with httpx.AsyncClient(headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            for page_url in self._build_page_urls(max_pages):
                log.info("scraping_page", source=self.SOURCE, url=page_url)
                try:
                    response = await client.get(page_url, timeout=30)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, "lxml")
                    listing_urls = self._extract_listing_links(soup)
                except Exception as exc:
                    log.error("generic_detail_page_error", source=self.SOURCE, url=page_url, error=str(exc))
                    continue

                if not listing_urls:
                    consecutive_empty_pages += 1
                    if consecutive_empty_pages >= self.EMPTY_PAGE_LIMIT:
                        break
                    continue

                consecutive_empty_pages = 0
                new_on_page = 0
                page_category = self._category_from_page_url(page_url)
                for detail_url in listing_urls:
                    if detail_url in seen_urls:
                        continue
                    seen_urls.add(detail_url)
                    try:
                        detail = await client.get(detail_url, timeout=30)
                        detail.raise_for_status()
                        payload = self._build_payload(
                            str(detail.url),
                            detail.text,
                            vehicle_category=page_category,
                        )
                        if not payload:
                            continue
                        self._upsert_listing(payload)
                        self.db.commit()
                        new_on_page += 1
                    except Exception as exc:
                        self.db.rollback()
                        log.error("generic_detail_item_error", source=self.SOURCE, url=detail_url, error=str(exc))

                if new_on_page == 0:
                    consecutive_empty_pages += 1
                    if consecutive_empty_pages >= self.EMPTY_PAGE_LIMIT:
                        break
