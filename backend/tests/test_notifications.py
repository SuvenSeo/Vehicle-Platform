"""Tests for the in-app notifications endpoints and record helper."""
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import notifications as notif_module
from db.models import Base, UserNotification


class _DummyRequest:
    method = "GET"
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()
    cookies: dict = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _seed_notification(db, *, user_token="tok-1", title="Test", body=None, link=None, read=False):
    notif = UserNotification(
        user_token=user_token,
        title=title,
        body=body,
        link=link,
        read=read,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


# ---------------------------------------------------------------------------
# list_notifications
# ---------------------------------------------------------------------------

def test_list_notifications_empty():
    db = _session()
    result = notif_module.list_notifications(
        request=_DummyRequest(),
        db=db,
        authorization=None,
        x_alert_token="tok-empty",
    )
    assert result == []


def test_list_notifications_returns_own():
    db = _session()
    _seed_notification(db, user_token="tok-a", title="Match A")
    _seed_notification(db, user_token="tok-b", title="Other")

    result = notif_module.list_notifications(
        request=_DummyRequest(),
        db=db,
        authorization=None,
        x_alert_token="tok-a",
    )
    assert len(result) == 1
    assert result[0].title == "Match A"


def test_list_notifications_ordered_newest_first():
    db = _session()
    n1 = _seed_notification(db, user_token="tok-order", title="First")
    n2 = _seed_notification(db, user_token="tok-order", title="Second")

    result = notif_module.list_notifications(
        request=_DummyRequest(),
        db=db,
        authorization=None,
        x_alert_token="tok-order",
    )
    ids = [n.id for n in result]
    # newest first (n2 > n1)
    assert ids.index(n2.id) < ids.index(n1.id)


def test_list_notifications_requires_token():
    db = _session()
    with pytest.raises(HTTPException) as exc_info:
        notif_module.list_notifications(
            request=_DummyRequest(),
            db=db,
            authorization=None,
            x_alert_token=None,
        )
    assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# mark_notification_read
# ---------------------------------------------------------------------------

def test_mark_notification_read_success():
    db = _session()
    n = _seed_notification(db, user_token="tok-read", title="Unread", read=False)
    assert n.read is False

    result = notif_module.mark_notification_read(
        notification_id=n.id,
        request=_DummyRequest(),
        db=db,
        authorization=None,
        x_alert_token="tok-read",
    )

    assert result.read is True
    db.expire_all()
    stored = db.query(UserNotification).filter(UserNotification.id == n.id).one()
    assert stored.read is True


def test_mark_notification_read_wrong_owner():
    db = _session()
    n = _seed_notification(db, user_token="tok-owner", title="Mine")

    with pytest.raises(HTTPException) as exc_info:
        notif_module.mark_notification_read(
            notification_id=n.id,
            request=_DummyRequest(),
            db=db,
            authorization=None,
            x_alert_token="tok-other",
        )
    assert exc_info.value.status_code == 404


def test_mark_notification_read_not_found():
    db = _session()
    with pytest.raises(HTTPException) as exc_info:
        notif_module.mark_notification_read(
            notification_id=9999,
            request=_DummyRequest(),
            db=db,
            authorization=None,
            x_alert_token="tok-xyz",
        )
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# mark_all_read
# ---------------------------------------------------------------------------

def test_mark_all_read_marks_own_only():
    db = _session()
    _seed_notification(db, user_token="tok-all", title="A", read=False)
    _seed_notification(db, user_token="tok-all", title="B", read=False)
    _seed_notification(db, user_token="tok-other", title="C", read=False)

    result = notif_module.mark_all_read(
        request=_DummyRequest(),
        db=db,
        authorization=None,
        x_alert_token="tok-all",
    )
    assert result["marked_read"] == 2

    db.expire_all()
    other = db.query(UserNotification).filter(UserNotification.user_token == "tok-other").one()
    assert other.read is False


def test_mark_all_read_idempotent():
    db = _session()
    _seed_notification(db, user_token="tok-idem", title="Already read", read=True)

    result = notif_module.mark_all_read(
        request=_DummyRequest(),
        db=db,
        authorization=None,
        x_alert_token="tok-idem",
    )
    assert result["marked_read"] == 0


# ---------------------------------------------------------------------------
# record_alert_match_notification helper
# ---------------------------------------------------------------------------

def test_record_alert_match_notification_creates_row():
    db = _session()
    notif = notif_module.record_alert_match_notification(
        db,
        user_token="tok-helper",
        make="Toyota",
        model="Axio",
        district="Colombo",
        max_price=5_000_000,
        new_match_count=3,
    )
    assert notif is not None

    db.commit()
    stored = db.query(UserNotification).filter(UserNotification.user_token == "tok-helper").one()
    assert "Toyota" in stored.title or "3" in stored.title
    assert stored.link == "/alerts"
    assert stored.read is False


def test_record_alert_match_notification_no_make():
    db = _session()
    notif = notif_module.record_alert_match_notification(
        db,
        user_token="tok-no-make",
        make=None,
        model=None,
        district=None,
        max_price=None,
        new_match_count=1,
    )
    assert notif is not None
    db.commit()
    stored = db.query(UserNotification).filter(UserNotification.user_token == "tok-no-make").one()
    assert stored.title  # should still have a title
