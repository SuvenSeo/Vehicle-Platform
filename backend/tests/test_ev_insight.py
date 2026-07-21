import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import stats
from db.models import Base, CarListing


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


_NOW = datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc)


def _listing(
    source_id: str,
    fuel_type: str | None,
    price_lkr: int | None = 8_000_000,
    make: str = "Nissan",
    model: str = "Leaf",
    is_outlier: bool = False,
) -> CarListing:
    return CarListing(
        source="ikman",
        source_id=source_id,
        scraped_at=_NOW,
        first_seen_at=_NOW,
        last_seen_at=_NOW,
        make=make,
        model=model,
        year=2021,
        price_lkr=price_lkr,
        deal_score=5.0,
        district="Colombo",
        city="Colombo",
        title=f"{make} {model} {source_id}",
        url=f"https://example.com/{source_id}",
        fuel_type=fuel_type,
        is_outlier=is_outlier,
    )


class TestGetEvInsight:
    def test_ev_count_and_pct_basic(self):
        db = _session()
        db.add_all([
            _listing("e1", "electric"),
            _listing("e2", "electric"),
            _listing("h1", "hybrid", make="Toyota", model="Aqua"),
            _listing("p1", "petrol", make="Honda", model="Fit"),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["ev_count"] == 2
        assert result["ev_pct"] == 50.0

    def test_ev_pct_zero_when_no_ev_listings(self):
        db = _session()
        db.add_all([
            _listing("h1", "hybrid", make="Toyota", model="Aqua"),
            _listing("p1", "petrol", make="Honda", model="Fit"),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["ev_count"] == 0
        assert result["ev_pct"] == 0.0

    def test_median_ev_price_odd_sample(self):
        db = _session()
        db.add_all([
            _listing("e1", "electric", price_lkr=5_000_000),
            _listing("e2", "electric", price_lkr=7_000_000),
            _listing("e3", "electric", price_lkr=9_000_000),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["median_ev_price_lkr"] == 7_000_000

    def test_median_ev_price_even_sample(self):
        db = _session()
        db.add_all([
            _listing("e1", "electric", price_lkr=6_000_000),
            _listing("e2", "electric", price_lkr=8_000_000),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["median_ev_price_lkr"] == 7_000_000

    def test_median_ev_price_none_when_no_priced_ev_listings(self):
        db = _session()
        db.add(_listing("e1", "electric", price_lkr=None))
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["median_ev_price_lkr"] is None

    def test_top_ev_models_ordered_by_listing_count(self):
        db = _session()
        db.add_all([
            _listing("e1", "electric", make="Nissan", model="Leaf"),
            _listing("e2", "electric", make="Nissan", model="Leaf"),
            _listing("e3", "electric", make="Nissan", model="Leaf"),
            _listing("e4", "electric", make="BYD", model="Atto3"),
            _listing("e5", "electric", make="BYD", model="Atto3"),
            _listing("e6", "electric", make="MG", model="ZS"),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        models = result["top_ev_models"]
        assert len(models) == 3
        assert models[0]["make"] == "Nissan"
        assert models[0]["model"] == "Leaf"
        assert models[0]["listing_count"] == 3
        assert models[1]["listing_count"] == 2

    def test_top_ev_models_respects_top_n_limit(self):
        db = _session()
        for i in range(6):
            db.add(_listing(f"e{i}", "electric", make="Brand", model=f"Model{i}"))
        db.commit()

        result = stats.get_ev_insight(top_n=3, db=db)

        assert len(result["top_ev_models"]) == 3

    def test_top_ev_models_median_price_per_model(self):
        db = _session()
        db.add_all([
            _listing("e1", "electric", price_lkr=5_000_000, make="Nissan", model="Leaf"),
            _listing("e2", "electric", price_lkr=9_000_000, make="Nissan", model="Leaf"),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        leaf = next(m for m in result["top_ev_models"] if m["model"] == "Leaf")
        assert leaf["median_price_lkr"] == 7_000_000

    def test_top_ev_models_payload_unchanged_and_query_count_not_n_plus_one(self):
        db = _session()
        db.add_all(
            [
                _listing("leaf-1", "electric", price_lkr=5_000_000, make="Nissan", model="Leaf"),
                _listing("leaf-2", "electric", price_lkr=7_000_000, make="Nissan", model="Leaf"),
                _listing("leaf-3", "electric", price_lkr=9_000_000, make="Nissan", model="Leaf"),
                _listing("atto-1", "electric", price_lkr=11_000_000, make="BYD", model="Atto3"),
                _listing("atto-2", "electric", price_lkr=13_000_000, make="BYD", model="Atto3"),
                _listing("zs-1", "electric", price_lkr=10_000_000, make="MG", model="ZS"),
                _listing("aqua-1", "hybrid", price_lkr=6_000_000, make="Toyota", model="Aqua"),
                _listing("aqua-2", "hybrid", price_lkr=8_000_000, make="Toyota", model="Aqua"),
            ]
        )
        db.commit()

        select_count = 0

        def _before_cursor_execute(_conn, _cursor, statement, _parameters, _context, _executemany):
            nonlocal select_count
            if statement.lstrip().upper().startswith("SELECT"):
                select_count += 1

        event.listen(db.bind, "before_cursor_execute", _before_cursor_execute)
        try:
            result = stats.get_ev_insight(top_n=3, db=db)
        finally:
            event.remove(db.bind, "before_cursor_execute", _before_cursor_execute)

        assert result["top_ev_models"] == [
            {"make": "Nissan", "model": "Leaf", "listing_count": 3, "median_price_lkr": 7_000_000.0},
            {"make": "BYD", "model": "Atto3", "listing_count": 2, "median_price_lkr": 12_000_000.0},
            {"make": "MG", "model": "ZS", "listing_count": 1, "median_price_lkr": 10_000_000.0},
        ]
        assert select_count <= 6

    def test_hybrid_benchmark_toyota_aqua(self):
        db = _session()
        db.add_all([
            _listing("a1", "hybrid", price_lkr=6_000_000, make="Toyota", model="Aqua"),
            _listing("a2", "hybrid", price_lkr=8_000_000, make="Toyota", model="Aqua"),
            _listing("e1", "electric", price_lkr=12_000_000),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        bm = result["hybrid_benchmark"]
        assert bm["make"] == "Toyota"
        assert bm["model"] == "Aqua"
        assert bm["median_price_lkr"] == 7_000_000
        assert bm["listing_count"] == 2

    def test_hybrid_benchmark_null_when_no_aqua_listings(self):
        db = _session()
        db.add(_listing("e1", "electric"))
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["hybrid_benchmark"]["median_price_lkr"] is None
        assert result["hybrid_benchmark"]["listing_count"] == 0

    def test_outliers_excluded_from_ev_count(self):
        db = _session()
        outlier = _listing("out1", "electric", is_outlier=True)
        db.add_all([
            _listing("e1", "electric"),
            outlier,
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["ev_count"] == 1

    def test_ev_fuel_type_case_insensitive(self):
        db = _session()
        db.add_all([
            _listing("e1", "Electric"),
            _listing("e2", "ELECTRIC"),
            _listing("e3", "electric"),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["ev_count"] == 3

    def test_price_below_minimum_excluded_from_medians(self):
        db = _session()
        db.add_all([
            _listing("e_cheap", "electric", price_lkr=50_000),
            _listing("e_valid", "electric", price_lkr=10_000_000),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["median_ev_price_lkr"] == 10_000_000

    def test_empty_database_returns_zeros(self):
        db = _session()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["ev_count"] == 0
        assert result["ev_pct"] == 0.0
        assert result["median_ev_price_lkr"] is None
        assert result["top_ev_models"] == []
        assert result["hybrid_benchmark"]["median_price_lkr"] is None

    def test_response_contains_required_keys(self):
        db = _session()
        db.add(_listing("e1", "electric"))
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert "ev_count" in result
        assert "ev_pct" in result
        assert "median_ev_price_lkr" in result
        assert "top_ev_models" in result
        assert "hybrid_benchmark" in result
        assert "generated_at" in result

    def test_non_ev_fuel_types_excluded_from_ev_count(self):
        db = _session()
        db.add_all([
            _listing("h1", "hybrid", make="Toyota", model="Aqua"),
            _listing("p1", "petrol", make="Honda", model="Fit"),
            _listing("d1", "diesel", make="Toyota", model="Land Cruiser"),
        ])
        db.commit()

        result = stats.get_ev_insight(top_n=5, db=db)

        assert result["ev_count"] == 0
        ev_models = result["top_ev_models"]
        assert all(
            m["make"] not in ("Honda", "Toyota") or m["model"] not in ("Fit", "Aqua", "Land Cruiser")
            for m in ev_models
        )
