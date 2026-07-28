import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import events as events_module
from app.models.schemas import AnalyticsEventCreate
from db.models import AnalyticsEvent, Base


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


class DummyRequest:
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()


def setup_function():
    events_module._events_rate_limiter._buckets.clear()


def test_record_event_persists_row():
    db = _session()
    receipt = events_module.record_event(
        AnalyticsEventCreate(
            event="listing_viewed",
            properties={"listing_id": 42, "source": "ikman"},
            session_id="sess-abc",
        ),
        request=DummyRequest(),
        db=db,
    )
    stored = db.query(AnalyticsEvent).one()
    assert receipt.id == stored.id
    assert stored.event == "listing_viewed"
    assert stored.properties == {"listing_id": 42, "source": "ikman"}
    assert stored.session_id == "sess-abc"


def test_record_event_minimal_payload():
    db = _session()
    receipt = events_module.record_event(
        AnalyticsEventCreate(event="page_view"),
        request=DummyRequest(),
        db=db,
    )
    stored = db.query(AnalyticsEvent).one()
    assert receipt.id == stored.id
    assert stored.event == "page_view"
    assert stored.properties is None
    assert stored.session_id is None


def test_record_event_strips_event_name():
    db = _session()
    events_module.record_event(
        AnalyticsEventCreate(event="  search_submit  "),
        request=DummyRequest(),
        db=db,
    )
    assert db.query(AnalyticsEvent).one().event == "search_submit"


def test_record_event_rate_limit_rejects_excess():
    request = DummyRequest()
    db = _session()

    for i in range(events_module._events_rate_limiter.max_requests):
        events_module._events_rate_limiter(request, now=float(1000 + i))

    try:
        events_module._events_rate_limiter(request, now=1060.0)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429
    else:
        raise AssertionError("analytics rate limiter should reject excess requests")


def test_record_event_allows_burst_then_recovers():
    request = DummyRequest()

    for i in range(events_module._events_rate_limiter.max_requests):
        events_module._events_rate_limiter(request, now=float(1000 + i))

    # After full window elapses, should accept again.
    recovered_ok = False
    try:
        events_module._events_rate_limiter(
            request,
            now=float(1000 + events_module._events_rate_limiter.window_seconds + 1),
        )
        recovered_ok = True
    except Exception:
        pass
    assert recovered_ok, "rate limiter should recover after window elapses"
