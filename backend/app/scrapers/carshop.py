from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.scrapers.generic_detail import GenericDetailScraper


class CarshopScraper(GenericDetailScraper):
    SOURCE = "carshop"
    BASE_URL = "https://www.carshop.lk/"
    START_URLS = ("https://www.carshop.lk/ords/carshop/r/carshop/carshop",)
    ALLOW_UNAVAILABLE_PRICE = True

    def _extract_title(self, soup: BeautifulSoup) -> str:
        visible_text = self._visible_text(soup)
        for match in re.finditer(r"\bAd header1\s+(.{5,140}?)\s+Price\b", visible_text, flags=re.IGNORECASE):
            candidate = re.sub(r"\s+", " ", match.group(1)).strip(" -|")
            if self.cleaner.clean_title(candidate).get("make"):
                return candidate
        return super()._extract_title(soup)

    @classmethod
    def _extract_listing_links(cls, soup: BeautifulSoup) -> list[str]:
        links: list[str] = []
        for link in soup.select("a[href*='item-details-new'][href*='p86_current_item_code=']"):
            href = urljoin(cls.BASE_URL, str(link.get("href") or "").strip())
            parsed = urlparse(href)
            if parsed.netloc and parsed.netloc != "www.carshop.lk":
                continue
            links.append(href)
        return cls._dedupe_keep_order(links)
