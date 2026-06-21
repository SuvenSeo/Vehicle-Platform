import random
import json
from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright
import structlog
from sqlalchemy.orm import Session
from db.models import CarListing
from app.scrapers.cleaner import CarCleaner

log = structlog.get_logger()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

class IkmanCarScraper:
    SOURCE = "ikman"
    BASE_URL = "https://ikman.lk/en/ads/sri-lanka/cars?sort=date&order=desc&page="

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
            existing.last_seen_at = datetime.utcnow()
            return False

        self.db.add(CarListing(**payload))
        return True

    @staticmethod
    def _normalize_thumbnail_url(candidate: str) -> str:
        value = str(candidate or "").strip()
        if not value:
            return ""
        if value.startswith("data:") or value.startswith("javascript:"):
            return ""
        if value.startswith("//"):
            return f"https:{value}"
        if value.startswith("/"):
            return urljoin("https://ikman.lk", value)
        return value

    @staticmethod
    def _is_placeholder_thumbnail(url: str) -> bool:
        token = str(url or "").strip().lower()
        if not token:
            return True
        return any(marker in token for marker in ("placeholder", "no-image", "noimage", "default"))

    @classmethod
    def _extract_thumbnail_from_detail_html(cls, html: str) -> str:
        if not html:
            return ""

        soup = BeautifulSoup(html, "lxml")

        for selector, attr in (
            ("meta[property='og:image']", "content"),
            ("meta[name='twitter:image']", "content"),
            ("meta[property='og:image:url']", "content"),
        ):
            node = soup.select_one(selector)
            if node:
                value = cls._normalize_thumbnail_url(node.get(attr))
                if value and not cls._is_placeholder_thumbnail(value):
                    return value

        for script in soup.select("script[type='application/ld+json']"):
            raw_json = script.get_text(" ", strip=True)
            if not raw_json:
                continue
            try:
                parsed = json.loads(raw_json)
            except Exception:
                continue

            nodes = parsed if isinstance(parsed, list) else [parsed]
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                image_value = node.get("image")
                image_candidates = image_value if isinstance(image_value, list) else [image_value]
                for candidate in image_candidates:
                    value = cls._normalize_thumbnail_url(candidate)
                    if value and not cls._is_placeholder_thumbnail(value):
                        return value

        for selector, attr in (
            ("img[src]", "src"),
            ("img[data-src]", "data-src"),
            ("img[data-lazy-src]", "data-lazy-src"),
        ):
            for node in soup.select(selector):
                value = cls._normalize_thumbnail_url(node.get(attr))
                if value and not cls._is_placeholder_thumbnail(value):
                    return value

        return ""

    async def _fetch_detail_thumbnail(self, context, listing_url: str) -> str:
        if not listing_url:
            return ""
        try:
            response = await context.request.get(listing_url, timeout=20_000)
            if not response.ok:
                return ""
            html = await response.text()
            return self._extract_thumbnail_from_detail_html(html)
        except Exception as exc:
            log.debug("ikman_detail_thumbnail_failed", url=listing_url, error=str(exc))
            return ""

    async def scrape(self, max_pages: int = 5):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = await context.new_page()
            consecutive_empty_pages = 0
            consecutive_page_errors = 0

            # Performance: block media
            async def route_handler(route):
                try:
                    if route.request.resource_type in {"image", "media", "font"}:
                        await route.abort()
                    else:
                        await route.continue_()
                except PlaywrightError:
                    log.debug("ikman_route_ignored", reason="page_or_context_closed")

            await page.route("**/*", route_handler)

            try:
                for page_num in range(1, max_pages + 1):
                    url = f"{self.BASE_URL}{page_num}"
                    log.info("scraping_page", source=self.SOURCE, page=page_num)

                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                        try:
                            await page.wait_for_selector("a.gtm-ad-item", timeout=8_000)
                        except PlaywrightTimeoutError:
                            log.info("ikman_selector_timeout", page=page_num)

                        listings = await page.query_selector_all("a.gtm-ad-item")
                        if not listings:
                            consecutive_empty_pages += 1
                            log.info(
                                "ikman_no_cards",
                                page=page_num,
                                consecutive_empty_pages=consecutive_empty_pages,
                            )
                            if consecutive_empty_pages >= 10:
                                break
                            continue

                        consecutive_empty_pages = 0
                        consecutive_page_errors = 0

                        for listing in listings:
                            try:
                                # 1. Basic Metadata
                                url_attr = await listing.get_attribute("href")
                                listing_url = f"https://ikman.lk{url_attr}" if url_attr else ""

                                title_elem = await listing.query_selector("h2")
                                title = (await title_elem.inner_text()).strip() if title_elem else ""

                                price_elem = await listing.query_selector("[class*='price']")
                                raw_price = (
                                    (await price_elem.inner_text()).strip() if price_elem else ""
                                )

                                loc_elem = await listing.query_selector("[class*='location']")
                                location_text = (
                                    (await loc_elem.inner_text()).strip()
                                    if loc_elem
                                    else "Sri Lanka"
                                )
                                # Extract district from "City, District"
                                district = (
                                    location_text.split(",")[-1].strip()
                                    if "," in location_text
                                    else location_text
                                )

                                img_elem = await listing.query_selector("img")
                                thumb_url = ""
                                if img_elem:
                                    for attr in ("src", "data-src", "data-lazy-src"):
                                        candidate = await img_elem.get_attribute(attr)
                                        normalized = self._normalize_thumbnail_url(candidate)
                                        if normalized:
                                            thumb_url = normalized
                                            break

                                    if not thumb_url:
                                        srcset = await img_elem.get_attribute(
                                            "srcset"
                                        ) or await img_elem.get_attribute("data-srcset")
                                        if srcset:
                                            first_image = srcset.split(",")[0].strip().split(
                                                " "
                                            )[0]
                                            normalized = self._normalize_thumbnail_url(first_image)
                                            if normalized:
                                                thumb_url = normalized

                                if not thumb_url or self._is_placeholder_thumbnail(thumb_url):
                                    thumb_url = await self._fetch_detail_thumbnail(context, listing_url)

                                # 2. Cleaning
                                data = self.cleaner.clean_title(title)
                                price = self.cleaner.clean_price(raw_price)

                                if not data["make"] or not price:
                                    continue

                                source_id = listing_url

                                # 3. DB Save
                                listing_payload = {
                                    "source_id": source_id,
                                    "source": self.SOURCE,
                                    "title": title,
                                    "make": data["make"],
                                    "model": data["model"] or "Other",
                                    "year": data["year"],
                                    "price_lkr": price,
                                    "url": listing_url,
                                    "thumbnail_url": thumb_url,
                                    "district": district,
                                    "condition": None, "_text_blobs": (await listing.inner_text()),
                                    "scraped_at": datetime.utcnow(),
                                }

                                normalized_payload = self.cleaner.normalize_listing_payload(
                                    listing_payload
                                )
                                if not normalized_payload:
                                    continue
                                self._upsert_listing(normalized_payload)
                                self.db.commit()
                            except Exception as e:
                                log.error("listing_save_error", error=str(e))
                                self.db.rollback()
                    except Exception as e:
                        log.error("page_scrape_error", page=page_num, error=str(e))
                        consecutive_page_errors += 1
                        if consecutive_page_errors >= 25:
                            break
                        continue
            finally:
                try:
                    await page.unroute_all(behavior="ignoreErrors")
                except PlaywrightError:
                    log.debug("ikman_unroute_cleanup_skipped")
                await browser.close()

