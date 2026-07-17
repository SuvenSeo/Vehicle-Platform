"""AutoLens Sri Lanka Used Vehicle Price Index.

A mix-adjusted (Laspeyres-style, like-for-like) monthly index over the
price_aggregates table. Fixed base-period weights prevent the index from
moving just because the mix of cheap vs expensive cars changed — it tracks
genuine price movement, the same method AutoTrader UK publishes.

Index_t = 100 * Σ(w_i * median_{i,t} / median_{i,base}) / Σ(w_i)
where the sum runs over cohorts i present in BOTH the base and period t,
and w_i = base-period listing_count of cohort i.
"""

from __future__ import annotations

from collections import defaultdict

import structlog
from sqlalchemy.orm import Session

from db.models import PriceAggregate

log = structlog.get_logger()

MIN_COHORT_LISTINGS = 3   # ignore ultra-thin cohorts in a period
MIN_PERIOD_COHORTS = 5    # a period needs this many like-for-like cohorts to publish


def _period_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _collect(rows) -> dict[str, dict[tuple, tuple[float, int]]]:
    """period -> {cohort_key: (median, listing_count)}."""
    out: dict[str, dict[tuple, tuple[float, int]]] = defaultdict(dict)
    for r in rows:
        if r.median_price_lkr is None or r.listing_count is None:
            continue
        if int(r.listing_count) < MIN_COHORT_LISTINGS:
            continue
        cohort = (r.make, r.model, r.year)
        out[_period_key(r.period_year, r.period_month)][cohort] = (
            float(r.median_price_lkr), int(r.listing_count)
        )
    return out


def _build_series(periods: dict[str, dict[tuple, tuple[float, int]]]) -> list[dict]:
    if not periods:
        return []
    ordered = sorted(periods.keys())
    base_period = ordered[0]
    base = periods[base_period]

    series: list[dict] = []
    prev_index: float | None = None
    for period in ordered:
        current = periods[period]
        shared = [c for c in current if c in base]
        if len(shared) < MIN_PERIOD_COHORTS:
            continue

        num = 0.0
        wsum = 0.0
        weighted_median_num = 0.0
        weighted_median_den = 0
        for cohort in shared:
            cur_median, cur_count = current[cohort]
            base_median, base_count = base[cohort]
            if base_median <= 0:
                continue
            w = base_count  # fixed base-period weight
            num += w * (cur_median / base_median)
            wsum += w
            weighted_median_num += cur_median * cur_count
            weighted_median_den += cur_count

        if wsum <= 0:
            continue
        index_value = round(100.0 * num / wsum, 2)
        median_price = round(weighted_median_num / weighted_median_den, 2) if weighted_median_den else 0.0
        mom = round((index_value - prev_index) / prev_index * 100, 2) if prev_index else None
        series.append({
            "period": period,
            "index_value": index_value,
            "median_price_lkr": median_price,
            "listing_count": weighted_median_den,
            "mom_change_pct": mom,
        })
        prev_index = index_value
    return series


def build_price_index(db: Session) -> dict:
    """Return the overall index plus per-make sub-indices."""
    rows = db.query(PriceAggregate).all()

    overall = _build_series(_collect(rows))

    # Sub-indices for the highest-volume makes (each self-based to 100).
    make_rows: dict[str, list] = defaultdict(list)
    for r in rows:
        make_rows[r.make].append(r)
    make_counts = {m: sum(int(r.listing_count or 0) for r in rs) for m, rs in make_rows.items()}
    top_makes = [m for m, _ in sorted(make_counts.items(), key=lambda kv: kv[1], reverse=True)[:4] if m]

    segments: dict[str, list[dict]] = {}
    for make in top_makes:
        seg = _build_series(_collect(make_rows[make]))
        if seg:
            segments[make] = seg

    return {
        "base_period": overall[0]["period"] if overall else None,
        "latest_period": overall[-1]["period"] if overall else None,
        "points": overall,
        "segments": segments,
        "methodology": (
            "Mix-adjusted (Laspeyres) index of used-vehicle asking prices across "
            "the AutoLens multi-source index. Each month is measured against a fixed "
            f"base period ({overall[0]['period'] if overall else 'n/a'} = 100) using "
            "like-for-like make/model/year cohorts weighted by base-period supply, so "
            "the index reflects genuine price movement, not changes in the mix of "
            "vehicles for sale. Asking prices, not confirmed transactions."
        ),
    }
