"""Tests for the Pro digest builder in scripts/send_pro_digest.py.

All tests run against in-memory SQLite; no network calls are made.
The build_digest_html() and query_* helpers are exercised in isolation so
the HTML contract can be verified without a real database or SendGrid.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# scripts/ is a sibling of the package root so add backend to sys.path.
sys.path.append(str(Path(__file__).resolve().parents[1]))

from db.models import Base, CarListing, MarketAlert, MarketAlertMatch
from scripts.send_pro_digest import (
    _pro_recipients_from_auth_users,
    build_digest_html,
    query_alert_stats,
    query_hot_deals,
    query_top_lanes,
    resolve_recipients,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _seed_listing(
    db,
    *,
    make="Toyota",
    model="Axio",
    price_lkr=3_000_000,
    district="Colombo",
    deal_score=75.0,
    is_outlier=False,
    source_id_suffix="",
):
    listing = CarListing(
        source="ikman",
        source_id=f"test-{make}-{model}-{price_lkr}{source_id_suffix}",
        scraped_at=datetime.now(timezone.utc),
        make=make,
        model=model,
        price_lkr=price_lkr,
        district=district,
        deal_score=deal_score,
        is_outlier=is_outlier,
        is_duplicate=False,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


# ---------------------------------------------------------------------------
# query_top_lanes
# ---------------------------------------------------------------------------


def test_query_top_lanes_returns_sorted_by_count():
    db = _session()
    for i in range(3):
        _seed_listing(db, make="Toyota", model="Axio", source_id_suffix=f"-{i}")
    for i in range(5):
        _seed_listing(db, make="Honda", model="Fit", price_lkr=2_500_000, source_id_suffix=f"-{i}")
    _seed_listing(db, make="Suzuki", model="Alto", price_lkr=1_800_000)

    lanes = query_top_lanes(db)

    assert lanes[0]["make"] == "Honda"
    assert lanes[0]["model"] == "Fit"
    assert lanes[0]["listing_count"] == 5
    assert lanes[1]["listing_count"] == 3


def test_query_top_lanes_excludes_outliers():
    db = _session()
    for i in range(3):
        _seed_listing(db, make="Toyota", model="Axio", source_id_suffix=f"-{i}")
    _seed_listing(db, make="Toyota", model="Axio", price_lkr=999_000_000, is_outlier=True, source_id_suffix="-outlier")

    lanes = query_top_lanes(db, limit=5)
    toyota_lane = next((l for l in lanes if l["make"] == "Toyota"), None)
    assert toyota_lane is not None
    assert toyota_lane["listing_count"] == 3


def test_query_top_lanes_has_price_stats():
    db = _session()
    _seed_listing(db, make="Toyota", model="Axio", price_lkr=3_000_000)
    _seed_listing(db, make="Toyota", model="Axio", price_lkr=5_000_000, source_id_suffix="-2")

    lanes = query_top_lanes(db, limit=1)
    assert lanes[0]["avg_price_lkr"] is not None
    assert lanes[0]["min_price_lkr"] == 3_000_000.0
    assert lanes[0]["max_price_lkr"] == 5_000_000.0


def test_query_top_lanes_returns_empty_on_no_data():
    db = _session()
    assert query_top_lanes(db) == []


# ---------------------------------------------------------------------------
# query_hot_deals
# ---------------------------------------------------------------------------


def test_query_hot_deals_returns_top_by_deal_score():
    db = _session()
    _seed_listing(db, make="Toyota", deal_score=90.0)
    _seed_listing(db, make="Honda", deal_score=70.0, source_id_suffix="-2")
    _seed_listing(db, make="Suzuki", deal_score=80.0, source_id_suffix="-3")

    deals = query_hot_deals(db, limit=2)

    assert len(deals) == 2
    assert deals[0]["deal_score"] == 90.0
    assert deals[1]["deal_score"] == 80.0


def test_query_hot_deals_excludes_outliers():
    db = _session()
    _seed_listing(db, make="Toyota", deal_score=90.0)
    _seed_listing(db, make="Bugatti", deal_score=99.0, is_outlier=True, source_id_suffix="-o")

    deals = query_hot_deals(db)
    makes = {d["make"] for d in deals}
    assert "Bugatti" not in makes


def test_query_hot_deals_returns_empty_on_no_data():
    db = _session()
    assert query_hot_deals(db) == []


# ---------------------------------------------------------------------------
# query_alert_stats
# ---------------------------------------------------------------------------


def test_query_alert_stats_counts_active_alerts():
    db = _session()
    db.add(MarketAlert(user_token="t1", make="Toyota", active=True))
    db.add(MarketAlert(user_token="t2", make="Honda", active=True))
    db.add(MarketAlert(user_token="t3", make="BMW", active=False))
    db.commit()

    stats = query_alert_stats(db)
    assert stats["active_alerts"] == 2


def test_query_alert_stats_sums_match_counts():
    db = _session()
    a1 = MarketAlert(user_token="t1", make="Toyota", active=True)
    a2 = MarketAlert(user_token="t2", make="Honda", active=True)
    db.add_all([a1, a2])
    db.commit()
    db.add(MarketAlertMatch(alert_id=a1.id, match_count=5, last_matched_at=datetime.now(timezone.utc)))
    db.add(MarketAlertMatch(alert_id=a2.id, match_count=3, last_matched_at=datetime.now(timezone.utc)))
    db.commit()

    stats = query_alert_stats(db)
    assert stats["total_matches"] == 8


def test_query_alert_stats_returns_zeros_on_empty_db():
    db = _session()
    stats = query_alert_stats(db)
    assert stats["active_alerts"] == 0
    assert stats["total_matches"] == 0


# ---------------------------------------------------------------------------
# build_digest_html
# ---------------------------------------------------------------------------


def test_build_digest_html_contains_title():
    now = datetime.now(timezone.utc)
    html = build_digest_html(
        generated_at=now,
        top_lanes=[],
        hot_deals=[],
        alert_stats={"active_alerts": 0, "total_matches": 0},
    )
    assert "Motormila Pro" in html
    assert "Weekly Market Digest" in html


def test_build_digest_html_includes_lane_data():
    now = datetime.now(timezone.utc)
    lanes = [
        {
            "make": "Toyota",
            "model": "Axio",
            "listing_count": 42,
            "avg_price_lkr": 3_500_000.0,
            "min_price_lkr": 2_800_000.0,
            "max_price_lkr": 4_200_000.0,
            "avg_deal_score": 72.5,
        }
    ]
    html = build_digest_html(
        generated_at=now,
        top_lanes=lanes,
        hot_deals=[],
        alert_stats={"active_alerts": 0, "total_matches": 0},
    )
    assert "Toyota Axio" in html
    assert "42" in html


def test_build_digest_html_includes_hot_deal():
    now = datetime.now(timezone.utc)
    deals = [
        {
            "id": 1,
            "title": "Toyota Axio 2019",
            "make": "Toyota",
            "model": "Axio",
            "year": 2019,
            "price_lkr": 3_200_000.0,
            "district": "Colombo",
            "deal_score": 88.0,
            "url": "https://example.com/listing/1",
        }
    ]
    html = build_digest_html(
        generated_at=now,
        top_lanes=[],
        hot_deals=deals,
        alert_stats={"active_alerts": 0, "total_matches": 0},
    )
    assert "Toyota Axio 2019" in html
    assert "88.0" in html
    assert "Colombo" in html


def test_build_digest_html_includes_alert_stats():
    now = datetime.now(timezone.utc)
    html = build_digest_html(
        generated_at=now,
        top_lanes=[],
        hot_deals=[],
        alert_stats={"active_alerts": 17, "total_matches": 234},
    )
    assert "17" in html
    assert "234" in html


def test_build_digest_html_is_valid_html_scaffold():
    now = datetime.now(timezone.utc)
    html = build_digest_html(
        generated_at=now,
        top_lanes=[],
        hot_deals=[],
        alert_stats={"active_alerts": 0, "total_matches": 0},
    )
    assert html.startswith("<!DOCTYPE html>")
    assert "</html>" in html


def test_build_digest_html_handles_none_prices():
    now = datetime.now(timezone.utc)
    lanes = [
        {
            "make": "Toyota",
            "model": "Axio",
            "listing_count": 5,
            "avg_price_lkr": None,
            "min_price_lkr": None,
            "max_price_lkr": None,
            "avg_deal_score": None,
        }
    ]
    html = build_digest_html(
        generated_at=now,
        top_lanes=lanes,
        hot_deals=[],
        alert_stats={"active_alerts": 0, "total_matches": 0},
    )
    assert "N/A" in html


# ---------------------------------------------------------------------------
# resolve_recipients / _pro_recipients_from_auth_users
# ---------------------------------------------------------------------------


def test_pro_recipients_from_auth_users_returns_pro_emails(monkeypatch):
    users = [
        {"email": "pro@example.com", "plan": "pro", "subscription_status": "active", "password_sha256": "x"},
        {"email": "enterprise@example.com", "plan": "enterprise", "subscription_status": "trialing", "password_sha256": "x"},
        {"email": "free@example.com", "plan": "free", "subscription_status": "active", "password_sha256": "x"},
        {"email": "lapsed@example.com", "plan": "pro", "subscription_status": "past_due", "password_sha256": "x"},
    ]
    monkeypatch.setenv("AUTH_USERS", __import__("json").dumps(users))

    result = _pro_recipients_from_auth_users()

    assert "pro@example.com" in result
    assert "enterprise@example.com" in result
    assert "free@example.com" not in result
    assert "lapsed@example.com" not in result


def test_pro_recipients_from_auth_users_returns_empty_when_not_set(monkeypatch):
    monkeypatch.delenv("AUTH_USERS", raising=False)
    assert _pro_recipients_from_auth_users() == []


def test_resolve_recipients_falls_back_to_digest_recipients(monkeypatch):
    monkeypatch.delenv("AUTH_USERS", raising=False)
    monkeypatch.setenv("DIGEST_RECIPIENTS", "a@b.com, c@d.com")

    result = resolve_recipients()

    assert result == ["a@b.com", "c@d.com"]


def test_resolve_recipients_prefers_auth_users_over_env(monkeypatch):
    users = [
        {"email": "pro@example.com", "plan": "pro", "subscription_status": "active", "password_sha256": "x"}
    ]
    monkeypatch.setenv("AUTH_USERS", __import__("json").dumps(users))
    monkeypatch.setenv("DIGEST_RECIPIENTS", "fallback@example.com")

    result = resolve_recipients()

    assert result == ["pro@example.com"]


def test_resolve_recipients_returns_empty_when_nothing_configured(monkeypatch):
    monkeypatch.delenv("AUTH_USERS", raising=False)
    monkeypatch.delenv("DIGEST_RECIPIENTS", raising=False)

    assert resolve_recipients() == []
