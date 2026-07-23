"""Curated Sri Lanka market-context seeds (DMT regs, policy eras).

Published government/macro figures stored as ``market_signals`` without
fragile PDF layout parsing. Values come from DMT Vehicle Population
2014–2025 and well-known policy dates.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from db.models import MarketSignal

DMT_POPULATION_PDF = (
    "https://dmt.gov.lk/images/2026/Vehicle_Population_2014-2025.pdf"
)

# Motor cars — year-end stock. From DMT Vehicle Population 2014–2025.
DMT_MOTOR_CAR_POPULATION: dict[int, int] = {
    2014: 566_874,
    2015: 672_502,
    2016: 717_674,
    2017: 756_856,
    2018: 837_632,
    2019: 875_864,
    2020: 896_885,
    2021: 900_380,
    2022: 901_869,
    2023: 903_685,
    2024: 905_329,
    2025: 973_376,
}

# New motor-car registrations by calendar year.
DMT_NEW_CAR_REGISTRATIONS: dict[int, int] = {
    2014: 38_780,
    2015: 105_628,
    2016: 45_172,
    2017: 39_182,
    2018: 80_776,
    2019: 38_232,
    2020: 21_021,
    2021: 3_495,
    2022: 1_489,
    2023: 1_816,
    2024: 1_644,
    2025: 68_047,
}

POLICY_EVENTS: tuple[dict[str, Any], ...] = (
    {
        "period_year": 2020,
        "period_month": 3,
        "metric": "import_controls_tightened",
        "value_numeric": 1.0,
        "unit": "flag",
        "notes": "COVID-era import controls begin tightening vehicle supply",
    },
    {
        "period_year": 2021,
        "period_month": 1,
        "metric": "import_ban_active",
        "value_numeric": 1.0,
        "unit": "flag",
        "notes": "Near-total passenger vehicle import freeze; new regs collapse",
    },
    {
        "period_year": 2022,
        "period_month": 9,
        "metric": "inflation_peak_crisis",
        "value_numeric": 45.21,
        "unit": "pct",
        "notes": "CBSL-reported peak inflation context for nominal price explosion",
    },
    {
        "period_year": 2025,
        "period_month": 2,
        "metric": "import_ban_lifted",
        "value_numeric": 1.0,
        "unit": "flag",
        "notes": "Import freeze lifted; high compound duties remain",
    },
)


def build_dmt_and_policy_signal_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for year, value in sorted(DMT_MOTOR_CAR_POPULATION.items()):
        rows.append(
            {
                "source": "dmt",
                "signal_type": "vehicle_population",
                "metric": "motor_cars_stock",
                "value_numeric": float(value),
                "unit": "vehicles",
                "category": "official",
                "source_url": DMT_POPULATION_PDF,
                "period_year": year,
                "period_month": 12,
                "raw_meta": {"series": "motor_cars_population", "confidence": "high"},
            }
        )
    for year, value in sorted(DMT_NEW_CAR_REGISTRATIONS.items()):
        rows.append(
            {
                "source": "dmt",
                "signal_type": "registrations",
                "metric": "motor_cars_new",
                "value_numeric": float(value),
                "unit": "vehicles",
                "category": "official",
                "source_url": DMT_POPULATION_PDF,
                "period_year": year,
                "period_month": 12,
                "raw_meta": {
                    "series": "motor_cars_new_registrations",
                    "confidence": "high",
                },
            }
        )
    for event in POLICY_EVENTS:
        rows.append(
            {
                "source": "policy",
                "signal_type": "regime_event",
                "metric": str(event["metric"]),
                "value_numeric": float(event["value_numeric"]),
                "unit": str(event.get("unit") or "flag"),
                "category": "policy",
                "source_url": DMT_POPULATION_PDF,
                "period_year": int(event["period_year"]),
                "period_month": int(event.get("period_month") or 1),
                "raw_meta": {
                    "notes": event.get("notes"),
                    "confidence": "high",
                },
            }
        )
    return rows


def upsert_market_context_signals(db: Session) -> dict[str, int]:
    """Insert curated DMT/policy signals; skip exact duplicates."""
    inserted = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for row in build_dmt_and_policy_signal_rows():
        existing = (
            db.query(MarketSignal.id)
            .filter(
                MarketSignal.source == row["source"],
                MarketSignal.signal_type == row["signal_type"],
                MarketSignal.metric == row["metric"],
                MarketSignal.period_year == row["period_year"],
                MarketSignal.period_month == row["period_month"],
            )
            .first()
        )
        if existing:
            skipped += 1
            continue

        db.add(
            MarketSignal(
                source=row["source"],
                signal_type=row["signal_type"],
                metric=row["metric"],
                value_numeric=row["value_numeric"],
                unit=row["unit"],
                category=row["category"],
                source_url=row["source_url"],
                period_year=row["period_year"],
                period_month=row["period_month"],
                observed_at=now,
                raw_meta=row.get("raw_meta") or {},
            )
        )
        inserted += 1

    if inserted:
        db.commit()
    return {"inserted": inserted, "skipped": skipped}
