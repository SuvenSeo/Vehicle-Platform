from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.scrapers.generic_detail import GenericDetailScraper


class RiyahubScraper(GenericDetailScraper):
    SOURCE = "riyahub"
    BASE_URL = "https://riyahub.lk"
    ALLOW_UNAVAILABLE_PRICE = True
    START_URLS = (
        "https://riyahub.lk/vehicle/cars",
        "https://riyahub.lk/vehicle/suvs",
        "https://riyahub.lk/vehicle/wagons",
        "https://riyahub.lk/vehicle/pickups",
        "https://riyahub.lk/vehicle/crew-cabs",
    )
    CATEGORY_PATHS = {
        "/vehicle",
        "/vehicle/",
        "/vehicle/cars",
        "/vehicle/cars/",
        "/vehicle/suvs",
        "/vehicle/suvs/",
        "/vehicle/wagons",
        "/vehicle/wagons/",
        "/vehicle/pickups",
        "/vehicle/pickups/",
        "/vehicle/crew-cabs",
        "/vehicle/crew-cabs/",
    }

    def _build_page_urls(self, max_pages: int) -> list[str]:
        page_limit = max(1, int(max_pages or 1))
        urls: list[str] = []
        for start_url in self.START_URLS:
            if len(urls) >= page_limit:
                return urls
            urls.append(start_url)
        for page_num in range(2, page_limit + 1):
            for start_url in self.START_URLS:
                if len(urls) >= page_limit:
                    return urls
                urls.append(f"{start_url.rstrip('/')}/page/{page_num}/")
        return urls

    @classmethod
    def _extract_listing_links(cls, soup: BeautifulSoup) -> list[str]:
        links: list[str] = []
        for link in soup.select("a[href*='/vehicle/']"):
            href = urljoin(cls.BASE_URL, str(link.get("href") or "").strip())
            parsed = urlparse(href)
            if parsed.netloc and parsed.netloc != "riyahub.lk":
                continue
            path = parsed.path.rstrip("/") or "/"
            if path in {item.rstrip("/") or "/" for item in cls.CATEGORY_PATHS}:
                continue
            parts = [part for part in path.split("/") if part]
            if len(parts) < 3 or parts[0] != "vehicle":
                continue
            links.append(href)

        for link in soup.select("a[href]"):
            href = urljoin(cls.BASE_URL, str(link.get("href") or "").strip())
            parsed = urlparse(href)
            if parsed.netloc and parsed.netloc != "riyahub.lk":
                continue
            if not re_fullmatch_sale_path(parsed.path):
                continue
            links.append(href)
        return cls._dedupe_keep_order(links)


def re_fullmatch_sale_path(path: str) -> bool:
    return bool(re.fullmatch(r"/[a-z0-9][a-z0-9-]+-sale-\d+/?", str(path or "").lower()))
