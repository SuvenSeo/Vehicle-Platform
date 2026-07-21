import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import dealer
from db.models import Base, CarListing, DealerProfile


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_claim_dealer_profile_creates_token_and_matches():
    db = _session()
    from datetime import datetime, timezone

    now = datetime(2026, 7, 21, tzinfo=timezone.utc)
    db.add(
        CarListing(
            source="ikman",
            source_id="d1",
            scraped_at=now,
            first_seen_at=now,
            last_seen_at=now,
            make="Toyota",
            model="Aqua",
            title="Toyota Aqua — Auto Hub LK Colombo",
            price_lkr=5_000_000,
            is_outlier=False,
            is_active=True,
        )
    )
    db.commit()

    result = dealer.claim_dealer_profile(
        dealer.DealerClaimRequest(
            display_name="Auto Hub LK",
            seller_name_pattern="Auto Hub LK",
            contact_phone="0771234567",
        ),
        db=db,
    )
    assert result.display_name == "Auto Hub LK"
    assert result.claim_token
    assert result.matched_listings == 1
    assert db.query(DealerProfile).count() == 1


def test_verify_dealer_requires_admin_token(monkeypatch):
    db = _session()
    monkeypatch.setenv("DEALER_ADMIN_TOKEN", "ops-secret")
    claimed = dealer.claim_dealer_profile(
        dealer.DealerClaimRequest(display_name="Yard One", seller_name_pattern="Yard"),
        db=db,
    )
    try:
        dealer.verify_dealer_profile(
            dealer.DealerVerifyRequest(claim_token=claimed.claim_token, admin_token="wrong"),
            db=db,
        )
        assert False, "expected 403"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403

    verified = dealer.verify_dealer_profile(
        dealer.DealerVerifyRequest(
            claim_token=claimed.claim_token,
            admin_token="ops-secret",
            plan="dealer",
            subscription_status="active",
            billing_email="billing@yard.lk",
        ),
        db=db,
    )
    assert verified.status == "verified"
    assert verified.subscription_status == "active"
    assert verified.billing_email == "billing@yard.lk"
    assert verified.verified_at is not None
