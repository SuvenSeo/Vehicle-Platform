"""Statistical price-outlier detection (IQR fences per make/model/year).

Flags ``is_outlier`` with an ``iqr:``-prefixed ``outlier_reason`` so the
pass can safely re-evaluate its own flags on every run without clobbering
manual or ingest-time flags. Groups smaller than ``min_group_size`` are
left untouched — a thin cohort cannot support a fence.
"""

from statistics import quantiles

import structlog
from sqlalchemy.orm import Session

from db.models import CarListing

log = structlog.get_logger()

REASON_PREFIX = "iqr:"
DEFAULT_MIN_GROUP_SIZE = 8
DEFAULT_IQR_MULTIPLIER = 1.5


def _fences(prices: list[float], multiplier: float) -> tuple[float, float]:
    q1, _q2, q3 = quantiles(prices, n=4, method="inclusive")
    iqr = q3 - q1
    return q1 - multiplier * iqr, q3 + multiplier * iqr


def mark_price_outliers(
    db: Session,
    *,
    min_group_size: int = DEFAULT_MIN_GROUP_SIZE,
    iqr_multiplier: float = DEFAULT_IQR_MULTIPLIER,
) -> dict:
    """Set/clear IQR-based outlier flags; returns {"flagged": n, "cleared": n}."""
    rows = (
        db.query(
            CarListing.id,
            CarListing.make,
            CarListing.model,
            CarListing.year,
            CarListing.price_lkr,
            CarListing.is_outlier,
            CarListing.outlier_reason,
        )
        .filter(
            CarListing.is_active == True,  # noqa: E712
            CarListing.price_lkr.isnot(None),
            CarListing.make.isnot(None),
            CarListing.model.isnot(None),
        )
        .all()
    )

    groups: dict[tuple, list] = {}
    for row in rows:
        key = (
            (row.make or "").strip().lower(),
            (row.model or "").strip().lower(),
            row.year,
        )
        groups.setdefault(key, []).append(row)

    flagged = 0
    cleared = 0
    for key, members in groups.items():
        prices = [float(m.price_lkr) for m in members]
        if len(prices) < min_group_size:
            # Too thin for a fence — clear only flags this pass created earlier.
            for m in members:
                if m.is_outlier and (m.outlier_reason or "").startswith(REASON_PREFIX):
                    db.query(CarListing).filter(CarListing.id == m.id).update(
                        {"is_outlier": False, "outlier_reason": None},
                        synchronize_session=False,
                    )
                    cleared += 1
            continue

        low, high = _fences(prices, iqr_multiplier)
        for m in members:
            price = float(m.price_lkr)
            is_iqr_flag = (m.outlier_reason or "").startswith(REASON_PREFIX)
            if price < low or price > high:
                if m.is_outlier and not is_iqr_flag:
                    continue  # keep manual/ingest flags untouched
                reason = (
                    f"{REASON_PREFIX}price {price:,.0f} outside "
                    f"[{max(low, 0):,.0f}–{high:,.0f}] for "
                    f"{key[0]} {key[1]} {key[2] or 'unknown-year'} (n={len(prices)})"
                )
                if not m.is_outlier or m.outlier_reason != reason:
                    db.query(CarListing).filter(CarListing.id == m.id).update(
                        {"is_outlier": True, "outlier_reason": reason},
                        synchronize_session=False,
                    )
                    flagged += 1
            elif m.is_outlier and is_iqr_flag:
                # Back inside the fence (price corrected or cohort shifted).
                db.query(CarListing).filter(CarListing.id == m.id).update(
                    {"is_outlier": False, "outlier_reason": None},
                    synchronize_session=False,
                )
                cleared += 1

    db.commit()
    log.info(
        "outlier_pass_complete",
        flagged=flagged,
        cleared=cleared,
        groups_evaluated=len(groups),
        min_group_size=min_group_size,
    )
    return {"flagged": flagged, "cleared": cleared}
