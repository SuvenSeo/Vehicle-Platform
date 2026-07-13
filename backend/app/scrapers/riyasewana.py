from datetime import datetime
from app.utils.time import utc_now
import os
import re
from urllib.parse import parse_qs, urljoin, urlparse

import structlog
from bs4 import BeautifulSoup
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright
from sqlalchemy.orm import Session

from app.scrapers.cleaner import CarCleaner
from db.models import CarListing

log = structlog.get_logger()


class RiyasewanaScraper:
    SOURCE = "riyasewana"
    BASE_URL = "https://riyasewana.com/search/cars"
    LISTING_SELECTOR = "ul.v-list li.v-card"
    LISTING_SELECTORS = (
        "ul.v-list li.v-card",
        "li.v-card",
        "div.v-card",
        "li[class*='v-card']",
    )

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
    def _extract_page_num(href: str) -> int | None:
        parsed = urlparse(urljoin("https://riyasewana.com", href))
        page_values = parse_qs(parsed.query).get("page")
        if not page_values:
            return None
        try:
            return int(page_values[0])
        except Exception:
            return None

    def _parse_pagination(self, soup: BeautifulSoup, current_page: int) -> tuple[bool, int]:
        has_next = False
        max_page_hint = current_page

        for link in soup.select("div.pagination a[href]"):
            href = str(link.get("href") or "").strip()
            if not href:
                continue

            label = link.get_text(" ", strip=True).lower()
            if label == "next":
                has_next = True

            page_num = self._extract_page_num(href)
            if page_num and page_num > max_page_hint:
                max_page_hint = page_num

        return has_next, max_page_hint

    @classmethod
    def _extract_cards(cls, soup: BeautifulSoup) -> list:
        for selector in cls.LISTING_SELECTORS:
            cards = soup.select(selector)
            if cards:
                return cards

        fallback_cards = []
        seen_nodes: set[int] = set()
        for link in soup.select("a[href*='/buy/']"):
            card = link.find_parent(["li", "div", "article"])
            if card is None:
                continue
            node_id = id(card)
            if node_id in seen_nodes:
                continue
            seen_nodes.add(node_id)
            fallback_cards.append(card)
        return fallback_cards

    @staticmethod
    def _is_challenge_page(soup: BeautifulSoup) -> bool:
        title = soup.title.get_text(" ", strip=True).lower() if soup.title else ""
        if "attention required" in title or "just a moment" in title:
            return True

        body_text = soup.get_text(" ", strip=True).lower()
        return (
            "verify you are human" in body_text
            or "checking your browser before accessing" in body_text
        )

    async def _load_page_with_retries(self, page, page_url: str, page_num: int) -> tuple[BeautifulSoup, list]:
        last_soup = BeautifulSoup("", "lxml")
        last_cards: list = []
        for attempt in range(1, 4):
            if attempt == 1:
                await page.goto(page_url, wait_until="domcontentloaded", timeout=45_000)
            else:
                await page.reload(wait_until="domcontentloaded", timeout=45_000)

            try:
                await page.wait_for_selector(self.LISTING_SELECTOR, timeout=20_000)
            except PlaywrightTimeoutError:
                pass

            await page.wait_for_timeout(3_000)
            await page.mouse.wheel(0, 1_800)
            await page.wait_for_timeout(1_500)

            soup = BeautifulSoup(await page.content(), "lxml")
            cards = self._extract_cards(soup)
            if cards:
                return soup, cards

            last_soup, last_cards = soup, cards
            title = soup.title.get_text(strip=True) if soup.title else "(no title)"
            if self._is_challenge_page(soup):
                log.warning("riyasewana_challenge_retry", page=page_num, attempt=attempt, title=title)
                await page.wait_for_timeout(12_000)  # wait longer for CF challenge to clear
            else:
                log.warning("riyasewana_no_cards_debug", page=page_num, attempt=attempt, title=title)
                if attempt < 3:
                    await page.wait_for_timeout(5_000)

        return last_soup, last_cards

    async def scrape(self, max_pages: int = 5):
        page_limit = max_pages if max_pages > 0 else None
        seen_urls: set[str] = set()
        page_num = 1
        consecutive_empty_pages = 0
        consecutive_page_errors = 0

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
                locale="en-US",
                timezone_id="Asia/Colombo",
                extra_http_headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                },
            )
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            page = await context.new_page()

            try:
                while True:
                    if page_limit is not None and page_num > page_limit:
                        break

                    page_url = self.BASE_URL if page_num == 1 else f"{self.BASE_URL}?page={page_num}"
                    log.info("scraping_page", source=self.SOURCE, page=page_num)

                    try:
                        soup, cards = await self._load_page_with_retries(page, page_url, page_num)
                        if not cards:
                            consecutive_empty_pages += 1
                            title = soup.title.get_text(strip=True) if soup.title else "(no title)"
                            log.info(
                                "riyasewana_no_cards",
                                page=page_num,
                                challenge_page=self._is_challenge_page(soup),
                                page_title=title,
                            )
                            if consecutive_empty_pages == 1:
                                # Dump first failure page for debugging
                                try:
                                    with open(f"debug_riyasewana_p{page_num}.html", "w", encoding="utf-8") as f:
                                        f.write(soup.prettify()[:50_000])
                                except Exception:
                                    pass
                            if consecutive_empty_pages >= 10:
                                break
                            page_num += 1
                            continue

                        new_on_page = 0

                        for card in cards:
                            try:
                                link = card.select_one("div.v-card-title a[href*='/buy/']") or card.select_one(
                                    "a[href*='/buy/']"
                                )
                                if not link:
                                    continue

                                listing_url = urljoin(
                                    "https://riyasewana.com", str(link.get("href") or "").strip()
                                )
                                if not listing_url or listing_url in seen_urls:
                                    continue

                                seen_urls.add(listing_url)
                                new_on_page += 1

                                title = link.get_text(" ", strip=True)
                                if not title:
                                    continue

                                raw_price = self._text(card, ["div.v-card-price", ".price", "[class*='price']"])
                                price = self.cleaner.normalize_price_lkr(raw_price)
                                if price is None:
                                    continue

                                data = self.cleaner.clean_title(title)
                                year_text = self._text(card, ["div.v-card-year", ".year", "[class*='year']"])
                                if not data["year"]:
                                    year_match = re.search(r"\b(19|20)\d{2}\b", year_text)
                                    if year_match:
                                        data["year"] = int(year_match.group(0))

                                if not data["make"]:
                                    continue

                                meta_text = self._text(card, ["div.v-card-meta", ".meta", "[class*='meta']"])
                                district = meta_text.split("·", 1)[0].strip() if meta_text else "Sri Lanka"

                                thumb_url = self._attr(
                                    card,
                                    [
                                        ("div.v-card-img img[src]", "src"),
                                        ("div.v-card-img img[data-src]", "data-src"),
                                    ],
                                )
                                thumb_url = (
                                    urljoin("https://riyasewana.com", thumb_url) if thumb_url else ""
                                )

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
                                log.error("riyasewana_item_error", page=page_num, error=str(e))
                                self.db.rollback()

                        has_next, max_page_hint = self._parse_pagination(soup, page_num)

                        if new_on_page == 0:
                            consecutive_empty_pages += 1
                            log.info(
                                "riyasewana_empty_page",
                                page=page_num,
                                consecutive_empty_pages=consecutive_empty_pages,
                            )
                            if consecutive_empty_pages >= 10:
                                break
                            page_num += 1
                            continue

                        if page_limit is None and not has_next and max_page_hint <= page_num:
                            break

                        consecutive_empty_pages = 0
                        page_num += 1
                        consecutive_page_errors = 0
                    except Exception as e:
                        log.error("riyasewana_page_error", page=page_num, error=str(e))
                        consecutive_page_errors += 1
                        if consecutive_page_errors >= 25:
                            break
                        page_num += 1
            finally:
                await context.close()
                await browser.close()

