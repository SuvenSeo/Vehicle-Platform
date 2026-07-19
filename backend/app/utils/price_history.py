"""Summarize per-listing price history rows for API responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any


def summarize_price_history(points: list[dict[str, Any]]) -> dict[str, Any]:
    """Derive cut/raise counts and range stats from ordered price points."""
    prices = [float(p["price_lkr"]) for p in points if p.get("price_lkr") is not None]
    scraped_times = [p.get("scraped_at") for p in points if p.get("scraped_at") is not None]

    cut_count = 0
    raise_count = 0
    last_change_at: datetime | None = None
    for prev, nxt, scraped_at in zip(prices, prices[1:], scraped_times[1:]):
        if nxt < prev:
            cut_count += 1
            last_change_at = scraped_at
        elif nxt > prev:
            raise_count += 1
            last_change_at = scraped_at

    first_price = prices[0] if prices else None
    current_price = prices[-1] if prices else None
    change_pct = None
    if first_price and current_price is not None and first_price > 0:
        change_pct = round((current_price - first_price) / first_price * 100, 1)

    return {
        "first_price_lkr": first_price,
        "current_price_lkr": current_price,
        "change_pct": change_pct,
        "cut_count": cut_count,
        "raise_count": raise_count,
        "highest_price_lkr": max(prices) if prices else None,
        "lowest_price_lkr": min(prices) if prices else None,
        "last_change_at": last_change_at,
        "tracked_points": len(prices),
    }
