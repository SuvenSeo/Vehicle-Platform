import argparse
import re
from decimal import Decimal
from typing import Optional

import httpx

from db.models import CarListing
from db.session import HotSessionLocal as SessionLocal


PRICE_PATTERN = re.compile(r"(?:Rs\.?|LKR)\s*([0-9][0-9,]*(?:\.[0-9]+)?)", re.IGNORECASE)
MIN_REASONABLE_PRICE_LKR = 100_000
MAX_REASONABLE_PRICE_LKR = 200_000_000


def extract_price_from_text(text: str) -> Optional[int]:
    if not text:
        return None
    match = PRICE_PATTERN.search(text)
    if not match:
        return None
    try:
        value = int(float(match.group(1).replace(",", "")))
        if MIN_REASONABLE_PRICE_LKR <= value <= MAX_REASONABLE_PRICE_LKR:
            return value
        return None
    except Exception:
        return None


def extract_price_from_detail_page(client: httpx.Client, url: str) -> Optional[int]:
    try:
        response = client.get(url, timeout=20)
        response.raise_for_status()
        html = response.text
    except Exception:
        return None

    match = PRICE_PATTERN.search(html)
    if not match:
        return None
    try:
        value = int(float(match.group(1).replace(",", "")))
        if MIN_REASONABLE_PRICE_LKR <= value <= MAX_REASONABLE_PRICE_LKR:
            return value
        return None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description="Repair stale/incorrect auto-lanka listing prices.")
    parser.add_argument("--listing-id", type=int, help="Repair only one listing id")
    parser.add_argument("--limit", type=int, default=500, help="Max rows to scan when listing-id is not provided")
    parser.add_argument("--apply", action="store_true", help="Persist changes. Without this flag, runs as dry-run.")
    args = parser.parse_args()

    db = SessionLocal()
    updated = 0
    scanned = 0

    query = db.query(CarListing).filter(CarListing.source == "auto-lanka")
    if args.listing_id:
        query = query.filter(CarListing.id == args.listing_id)
    else:
        query = query.order_by(CarListing.id.desc()).limit(args.limit)

    rows = query.all()
    with httpx.Client(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        for row in rows:
            scanned += 1
            current_price = int(float(row.price_lkr)) if row.price_lkr is not None else None

            title_price = extract_price_from_text(row.title or "")
            candidate = title_price
            if candidate is None and row.url:
                candidate = extract_price_from_detail_page(client, row.url)

            if candidate is None:
                continue
            if current_price == candidate:
                continue

            print(
                f"listing_id={row.id} old={current_price} new={candidate} url={row.url}"
            )
            updated += 1

            if args.apply:
                row.price_lkr = Decimal(str(candidate))

    if args.apply and updated > 0:
        db.commit()
    else:
        db.rollback()

    db.close()
    mode = "APPLY" if args.apply else "DRY_RUN"
    print(f"{mode}: scanned={scanned} updated={updated}")


if __name__ == "__main__":
    main()