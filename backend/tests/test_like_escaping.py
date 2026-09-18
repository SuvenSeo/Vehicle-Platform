"""LIKE/ILIKE wildcard escaping must keep user text literal."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.like_pattern import LIKE_ESCAPE_CHAR, contains_pattern, escape_like


def test_escape_like_escapes_percent_underscore_and_backslash():
    assert escape_like("100%") == "100\\%"
    assert escape_like("a_b") == "a\\_b"
    assert escape_like(r"C:\path") == r"C:\\path"


def test_contains_pattern_wraps_escaped_value():
    assert contains_pattern("20_km") == "%20\\_km%"
    # A bare wildcard stays a wildcard when wrapped — escaping keeps it literal.
    assert contains_pattern("%") == "%\\%%"
    assert contains_pattern("") == "%%"


def test_wildcard_search_token_matches_literally_on_sqlite(tmp_path):
    """A `%` in a search token must not act as a wildcard."""
    from datetime import datetime, timezone

    from sqlalchemy import create_engine, or_
    from sqlalchemy.orm import sessionmaker

    from db.models import Base, CarListing

    engine = create_engine(f"sqlite:///{tmp_path / 'escape.db'}", future=True)
    Base.metadata.create_all(engine, tables=[CarListing.__table__])
    Session = sessionmaker(bind=engine)

    now = datetime(2026, 9, 18, tzinfo=timezone.utc)

    def listing(make: str, model: str) -> CarListing:
        return CarListing(
            source="ikman",
            source_id=f"x-{make}-{model}",
            scraped_at=now,
            make=make,
            model=model,
            year=2020,
            price_lkr=6_000_000,
        )

    with Session() as db:
        db.add_all(
            [
                # make doubles as arbitrary text we control for the assertion
                listing("Toyota", "Prius"),
                listing("100% Electric", "Leaf"),
                listing("Nissan", "Leaf"),
            ]
        )
        db.commit()

        pattern = contains_pattern("100%")
        rows = (
            db.query(CarListing)
            .filter(
                or_(
                    CarListing.make.ilike(pattern, escape=LIKE_ESCAPE_CHAR),
                    CarListing.model.ilike(pattern, escape=LIKE_ESCAPE_CHAR),
                )
            )
            .all()
        )
        assert [row.make for row in rows] == ["100% Electric"]

        # The real regression: a bare "%" token used to widen to everything.
        # Escaped, it must match only the row that literally contains "%".
        star = contains_pattern("%")
        escaped_hits = (
            db.query(CarListing)
            .filter(CarListing.make.ilike(star, escape=LIKE_ESCAPE_CHAR))
            .count()
        )
        unescaped_hits = db.query(CarListing).filter(CarListing.make.ilike("%%%")).count()
        assert escaped_hits == 1  # only "100% Electric"
        assert unescaped_hits == 3  # old behavior: matched every row


def test_escape_like_handles_none():
    assert escape_like(None) == ""
