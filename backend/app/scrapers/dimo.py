from __future__ import annotations

from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.scrapers.generic_detail import GenericDetailScraper


class DimoScraper(GenericDetailScraper):
    SOURCE = "dimo"
    BASE_URL = "https://carsatdimo.lk"
    ALLOW_UNAVAILABLE_PRICE = True
    START_URLS = (
        "https://carsatdimo.lk/product-category/all-vehicles/",
        "https://carsatdimo.lk/",
    )

    def _build_page_urls(self, max_pages: int) -> list[str]:
        page_limit = max(1, int(max_pages or 1))
        urls: list[str] = []
        for start_url in self.START_URLS:
            if len(urls) >= page_limit:
                return urls
            urls.append(start_url)
        product_category = self.START_URLS[0]
        for page_num in range(2, page_limit + 1):
            if len(urls) >= page_limit:
                return urls
            urls.append(f"{product_category.rstrip('/')}/page/{page_num}/")
        return urls

    @classmethod
    def _extract_listing_links(cls, soup: BeautifulSoup) -> list[str]:
        links: list[str] = []
        for link in soup.select("a[href*='/product/']"):
            href = urljoin(cls.BASE_URL, str(link.get("href") or "").strip())
            parsed = urlparse(href)
            if parsed.netloc and parsed.netloc != "carsatdimo.lk":
                continue
            if "/product-category/" in parsed.path:
                continue
            if "/product/" not in parsed.path:
                continue
            links.append(href)
        return cls._dedupe_keep_order(links)
