import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import feedback
from app.models.schemas import FeedbackCreate
from db.models import Base, UserFeedback


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


class DummyRequest:
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()


def setup_function():
    feedback._RATE_LIMIT_BUCKETS.clear()


def test_create_feedback_persists_user_report():
    db = _session()

    receipt = feedback.create_feedback(
        FeedbackCreate(category="bug", route="/trends", message="Trend chart fallback looks wrong."),
        request=DummyRequest(),
        db=db,
    )

    stored = db.query(UserFeedback).one()
    assert receipt.id == stored.id
    assert stored.category == "bug"
    assert stored.route == "/trends"
    assert stored.user_agent == "pytest"


def test_create_feedback_normalizes_unknown_category():
    db = _session()

    feedback.create_feedback(
        FeedbackCreate(category="billing", route="/", message="This category should be normalized."),
        request=DummyRequest(),
        db=db,
    )

    assert db.query(UserFeedback).one().category == "general"


def test_feedback_rate_limit_rejects_repeated_submissions():
    request = DummyRequest()

    for index in range(feedback.RATE_LIMIT_MAX_REQUESTS):
        feedback._enforce_feedback_rate_limit(request, now=1000 + index)

    try:
        feedback._enforce_feedback_rate_limit(request, now=1005)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429
    else:
        raise AssertionError("feedback rate limit should reject repeated submissions")
