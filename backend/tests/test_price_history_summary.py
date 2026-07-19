import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.price_history import summarize_price_history


def test_summarize_price_history_counts_cuts_and_raises():
    points = [
        {"price_lkr": 10_000_000, "scraped_at": "2026-07-01T10:00:00Z"},
        {"price_lkr": 9_500_000, "scraped_at": "2026-07-05T10:00:00Z"},
        {"price_lkr": 9_800_000, "scraped_at": "2026-07-08T10:00:00Z"},
        {"price_lkr": 9_200_000, "scraped_at": "2026-07-12T10:00:00Z"},
    ]
    summary = summarize_price_history(points)

    assert summary["first_price_lkr"] == 10_000_000
    assert summary["current_price_lkr"] == 9_200_000
    assert summary["change_pct"] == -8.0
    assert summary["cut_count"] == 2
    assert summary["raise_count"] == 1
    assert summary["highest_price_lkr"] == 10_000_000
    assert summary["lowest_price_lkr"] == 9_200_000
    assert summary["tracked_points"] == 4
    assert summary["last_change_at"] is not None


def test_summarize_price_history_empty_points():
    summary = summarize_price_history([])
    assert summary["tracked_points"] == 0
    assert summary["cut_count"] == 0
