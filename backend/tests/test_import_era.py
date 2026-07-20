"""Tests for import-era classification utility and /stats/import-era-split endpoint."""

import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.utils.import_era import classify_import_era, era_label, FREEZE_BOUNDARY_YEAR
from app.api.v1.endpoints.stats import get_import_era_split
from db.models import Base, CarListing


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 7, 13, 10, 0, tzinfo=timezone.utc)


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _listing(
    source_id: str,
    make: str,
    year: int | None,
    price_lkr: int | None = 6_000_000,
    is_outlier: bool = False,
) -> CarListing:
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=_NOW,
        first_seen_at=_NOW,
        last_seen_at=_NOW,
        make=make,
        model="Model",
        year=year,
        price_lkr=price_lkr,
        deal_score=5.0,
        district="Colombo",
        city="Colombo",
        title=f"{make} Model {source_id}",
        url=f"https://example.com/{source_id}",
        is_outlier=is_outlier,
    )


# ---------------------------------------------------------------------------
# classify_import_era
# ---------------------------------------------------------------------------


class TestClassifyImportEra:
    def test_year_below_boundary_is_pre_freeze(self):
        assert classify_import_era(2024) == "pre_freeze"

    def test_year_at_boundary_is_post_freeze(self):
        assert classify_import_era(FREEZE_BOUNDARY_YEAR) == "post_freeze"

    def test_year_above_boundary_is_post_freeze(self):
        assert classify_import_era(2030) == "post_freeze"

    def test_old_year_is_pre_freeze(self):
        assert classify_import_era(2000) == "pre_freeze"

    def test_none_returns_none(self):
        assert classify_import_era(None) is None

    def test_boundary_year_constant_is_2025(self):
        assert FREEZE_BOUNDARY_YEAR == 2025

    def test_year_2023_is_pre_freeze(self):
        assert classify_import_era(2023) == "pre_freeze"

    def test_year_2026_is_post_freeze(self):
        assert classify_import_era(2026) == "post_freeze"


# ---------------------------------------------------------------------------
# era_label
# ---------------------------------------------------------------------------


class TestEraLabel:
    def test_pre_freeze_label(self):
        label = era_label("pre_freeze")
        assert "pre" in label.lower() or "2024" in label

    def test_post_freeze_label(self):
        label = era_label("post_freeze")
        assert "post" in label.lower() or "2025" in label


# ---------------------------------------------------------------------------
# get_import_era_split
# ---------------------------------------------------------------------------


class TestGetImportEraSplit:
    def test_returns_top_makes_structure(self):
        db = _session()
        db.add_all([
            _listing("t1", "Toyota", 2023, 5_000_000),
            _listing("t2", "Toyota", 2025, 8_000_000),
            _listing("h1", "Honda", 2022, 4_500_000),
            _listing("h2", "Honda", 2026, 7_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        assert "makes" in result
        assert "generated_at" in result
        assert "freeze_boundary_year" in result
        assert result["freeze_boundary_year"] == FREEZE_BOUNDARY_YEAR
        makes = {row["make"]: row for row in result["makes"]}
        assert "Toyota" in makes
        assert "Honda" in makes

    def test_pre_freeze_counts_correct(self):
        db = _session()
        db.add_all([
            _listing("t1", "Toyota", 2022, 5_000_000),
            _listing("t2", "Toyota", 2023, 6_000_000),
            _listing("t3", "Toyota", 2025, 9_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert toyota["pre_freeze"]["count"] == 2
        assert toyota["post_freeze"]["count"] == 1

    def test_post_freeze_counts_correct(self):
        db = _session()
        db.add_all([
            _listing("s1", "Suzuki", 2024, 3_500_000),
            _listing("s2", "Suzuki", 2025, 5_000_000),
            _listing("s3", "Suzuki", 2026, 6_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        suzuki = makes["Suzuki"]
        assert suzuki["pre_freeze"]["count"] == 1
        assert suzuki["post_freeze"]["count"] == 2

    def test_median_price_calculated_correctly(self):
        db = _session()
        db.add_all([
            _listing("t1", "Toyota", 2022, 4_000_000),
            _listing("t2", "Toyota", 2023, 6_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert toyota["pre_freeze"]["median_price_lkr"] == 5_000_000.0

    def test_era_with_no_listings_has_zero_count_and_null_median(self):
        db = _session()
        db.add(_listing("t1", "Toyota", 2022, 5_000_000))
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert toyota["post_freeze"]["count"] == 0
        assert toyota["post_freeze"]["median_price_lkr"] is None

    def test_outliers_are_excluded(self):
        db = _session()
        outlier = _listing("out1", "Toyota", 2022, 5_000_000, is_outlier=True)
        db.add_all([
            _listing("t1", "Toyota", 2023, 6_000_000),
            outlier,
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert toyota["pre_freeze"]["count"] == 1

    def test_listings_without_year_are_excluded(self):
        db = _session()
        db.add_all([
            _listing("t1", "Toyota", None, 5_000_000),
            _listing("t2", "Toyota", 2022, 6_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert toyota["pre_freeze"]["count"] == 1

    def test_listings_with_price_below_minimum_are_excluded(self):
        db = _session()
        db.add_all([
            _listing("t1", "Toyota", 2022, 50_000),
            _listing("t2", "Toyota", 2023, 6_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        # t1 is below MIN_REASONABLE_PRICE_LKR so excluded entirely
        assert toyota["pre_freeze"]["count"] == 1

    def test_listings_without_price_are_excluded(self):
        db = _session()
        db.add_all([
            _listing("t1", "Toyota", 2022, None),
            _listing("t2", "Toyota", 2023, 6_000_000),
        ])
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert toyota["pre_freeze"]["count"] == 1

    def test_empty_database_returns_empty_makes(self):
        db = _session()

        result = get_import_era_split(db=db)

        assert result["makes"] == []

    def test_top_n_limits_number_of_makes(self):
        db = _session()
        makes = ["Toyota", "Honda", "Suzuki", "Nissan", "Mazda"]
        for i, make in enumerate(makes):
            db.add(_listing(f"{make[0]}{i}", make, 2022, 5_000_000))
        db.commit()

        result = get_import_era_split(db=db, top_n=3)

        assert len(result["makes"]) <= 3

    def test_era_label_present_in_response(self):
        db = _session()
        db.add(_listing("t1", "Toyota", 2023, 5_000_000))
        db.commit()

        result = get_import_era_split(db=db)

        makes = {row["make"]: row for row in result["makes"]}
        toyota = makes["Toyota"]
        assert "label" in toyota["pre_freeze"]
        assert "label" in toyota["post_freeze"]

    def test_default_top_n_returns_at_most_10_makes(self):
        db = _session()
        for i in range(15):
            db.add(_listing(f"m{i}", f"Make{i:02d}", 2022, 5_000_000))
        db.commit()

        result = get_import_era_split(db=db)

        assert len(result["makes"]) <= 10
