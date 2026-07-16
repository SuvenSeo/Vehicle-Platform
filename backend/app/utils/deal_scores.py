from __future__ import annotations

import structlog
from sqlalchemy import and_, func, select, update
from sqlalchemy.orm import Session

from db.models import CarListing, PriceAggregate, live_listing_filter

logger = structlog.get_logger()

# Listings whose market median is below this LKR threshold are skipped – the
# aggregate data is considered too sparse to be meaningful.
_MIN_MEDIAN_LKR = 100_000.0
_SCORE_MAX = 100.0
_SCORE_MIN = -100.0


def _clamp_score(raw: float) -> float:
    """Clamp raw deal score to [-100, 100] and round to one decimal place."""
    return max(_SCORE_MIN, min(_SCORE_MAX, round(raw, 1)))


def _build_listing_median_select():
    """
    Return a SQLAlchemy Core SELECT that produces (id, price_lkr, best_median)
    for every eligible car listing.

    Eligibility: price_lkr IS NOT NULL, is_outlier = False, is_duplicate = False.

    best_median resolution (mirrors existing aggregator logic):
      1. District-specific median from the most recent period for
         (make, model, year, district) — preferred.
      2. National median — average of all district medians from the most recent
         period for (make, model, year) — used as fallback.

    Listings that match no aggregate row receive NULL for best_median and are
    excluded from updates by the caller.
    """
    # ------------------------------------------------------------------ #
    # Subquery 1: latest period stamp per (make, model, year)             #
    # Used to anchor the national median to the most recent data.         #
    # ------------------------------------------------------------------ #
    nat_latest_sq = (
        select(
            PriceAggregate.make,
            PriceAggregate.model,
            PriceAggregate.year,
            func.max(
                PriceAggregate.period_year * 100 + PriceAggregate.period_month
            ).label("max_ym"),
        )
        .group_by(PriceAggregate.make, PriceAggregate.model, PriceAggregate.year)
        .subquery("nat_latest")
    )

    # ------------------------------------------------------------------ #
    # Subquery 2: national (cross-district) average median per group      #
    # Averaging mirrors CarPriceAggregator.update_deal_scores n_map logic #
    # ------------------------------------------------------------------ #
    nat_agg_sq = (
        select(
            PriceAggregate.make,
            PriceAggregate.model,
            PriceAggregate.year,
            func.avg(PriceAggregate.median_price_lkr).label("median"),
        )
        .join(
            nat_latest_sq,
            and_(
                PriceAggregate.make == nat_latest_sq.c.make,
                PriceAggregate.model == nat_latest_sq.c.model,
                PriceAggregate.year == nat_latest_sq.c.year,
                (PriceAggregate.period_year * 100 + PriceAggregate.period_month)
                == nat_latest_sq.c.max_ym,
            ),
        )
        .group_by(PriceAggregate.make, PriceAggregate.model, PriceAggregate.year)
        .subquery("nat_agg")
    )

    # ------------------------------------------------------------------ #
    # Subquery 3: latest period stamp per (make, model, year, district)   #
    # Only non-NULL districts are considered for district-level lookup.   #
    # ------------------------------------------------------------------ #
    dist_latest_sq = (
        select(
            PriceAggregate.make,
            PriceAggregate.model,
            PriceAggregate.year,
            PriceAggregate.district,
            func.max(
                PriceAggregate.period_year * 100 + PriceAggregate.period_month
            ).label("max_ym"),
        )
        .where(PriceAggregate.district.isnot(None))
        .group_by(
            PriceAggregate.make,
            PriceAggregate.model,
            PriceAggregate.year,
            PriceAggregate.district,
        )
        .subquery("dist_latest")
    )

    # ------------------------------------------------------------------ #
    # Subquery 4: district-specific median per group                      #
    # ------------------------------------------------------------------ #
    dist_agg_sq = (
        select(
            PriceAggregate.make,
            PriceAggregate.model,
            PriceAggregate.year,
            PriceAggregate.district,
            PriceAggregate.median_price_lkr.label("median"),
        )
        .join(
            dist_latest_sq,
            and_(
                PriceAggregate.make == dist_latest_sq.c.make,
                PriceAggregate.model == dist_latest_sq.c.model,
                PriceAggregate.year == dist_latest_sq.c.year,
                PriceAggregate.district == dist_latest_sq.c.district,
                (PriceAggregate.period_year * 100 + PriceAggregate.period_month)
                == dist_latest_sq.c.max_ym,
            ),
        )
        .subquery("dist_agg")
    )

    # ------------------------------------------------------------------ #
    # Main SELECT: listings LEFT JOINed to both aggregate subqueries      #
    # ------------------------------------------------------------------ #
    return (
        select(
            CarListing.id,
            CarListing.price_lkr,
            func.coalesce(dist_agg_sq.c.median, nat_agg_sq.c.median).label("best_median"),
        )
        .select_from(CarListing)
        .outerjoin(
            dist_agg_sq,
            and_(
                CarListing.make == dist_agg_sq.c.make,
                CarListing.model == dist_agg_sq.c.model,
                CarListing.year == dist_agg_sq.c.year,
                CarListing.district == dist_agg_sq.c.district,
            ),
        )
        .outerjoin(
            nat_agg_sq,
            and_(
                CarListing.make == nat_agg_sq.c.make,
                CarListing.model == nat_agg_sq.c.model,
                CarListing.year == nat_agg_sq.c.year,
            ),
        )
        .where(
            CarListing.price_lkr.isnot(None),
            live_listing_filter(),  # noqa: E712 – SQLAlchemy requires == not is
            CarListing.is_duplicate == False,  # noqa: E712
        )
    )


def bulk_refresh_deal_scores(db: Session, *, batch_size: int = 5000) -> dict:
    """
    Bulk-refresh ``deal_score`` and ``market_median_lkr`` on all eligible
    ``car_listings`` rows using a single SQL JOIN against ``price_aggregates``.

    Replaces the slow per-row Python loop in
    ``CarPriceAggregator.update_deal_scores`` with batched Core UPDATE
    statements (SQLAlchemy ``executemany`` at the driver level).

    Eligibility:
      - ``price_lkr`` is set
      - ``is_outlier = False``
      - ``is_duplicate = False``

    Median resolution: district-specific aggregate > national (cross-district)
    average, both anchored to the most recent ``period_year``/``period_month``.

    Args:
        db: Active SQLAlchemy session (commits incrementally per batch).
        batch_size: Number of rows per ``executemany`` batch / commit cycle.
                    Tune for memory vs. transaction size trade-off.

    Returns:
        ``{"updated": int, "skipped_no_median": int, "batches": int}``
    """
    logger.info("bulk_refresh_deal_scores_start", batch_size=batch_size)

    stmt = _build_listing_median_select()
    rows = db.execute(stmt).fetchall()

    updated = 0
    skipped_no_median = 0
    batches = 0
    batch: list[dict] = []

    for row in rows:
        best_median = row.best_median

        if best_median is None or float(best_median) < _MIN_MEDIAN_LKR:
            skipped_no_median += 1
            continue

        price = float(row.price_lkr)
        median = float(best_median)

        if price <= 0 or median <= 0:
            skipped_no_median += 1
            continue

        raw_score = (1.0 - price / median) * 100.0
        batch.append(
            {
                "id": row.id,
                "market_median_lkr": round(median, 2),
                "deal_score": _clamp_score(raw_score),
            }
        )

        if len(batch) >= batch_size:
            db.execute(update(CarListing), batch)
            db.commit()
            updated += len(batch)
            batches += 1
            logger.info(
                "bulk_refresh_deal_scores_batch",
                batch=batches,
                cumulative_updated=updated,
            )
            batch = []

    if batch:
        db.execute(update(CarListing), batch)
        db.commit()
        updated += len(batch)
        batches += 1

    logger.info(
        "bulk_refresh_deal_scores_done",
        updated=updated,
        skipped_no_median=skipped_no_median,
        batches=batches,
    )
    return {"updated": updated, "skipped_no_median": skipped_no_median, "batches": batches}
