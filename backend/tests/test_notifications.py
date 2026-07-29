"""Tests for in-app alert notification endpoints."""

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import notifications as notifications_module
from db.models import Base, UserNotification


class _DummyRequest:
    method = "GET"
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()
    cookies: dict = {}


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _make_notification(db, *, token="tok-owner", title="New match"):
    notification = UserNotification(
        user_token=token,
        title=title,
        body="Toyota Axio has one new matching listing.",
        href="/alerts",
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def test_list_notifications_returns_recent_for_owner_only():
    db = _session()
    owned = _make_notification(db, token="tok-owner", title="Owned")
    _make_notification(db, token="tok-other", title="Other")

    result = notifications_module.list_notifications(
        request=_DummyRequest(),
        token="tok-owner",
        db=db,
    )

    assert [row.id for row in result] == [owned.id]
    assert result[0].title == "Owned"


def test_mark_notification_read_sets_read_at():
    db = _session()
    notification = _make_notification(db, token="tok-owner")

    result = notifications_module.mark_notification_read(
        notification_id=notification.id,
        request=_DummyRequest(),
        x_alert_token="tok-owner",
        db=db,
    )

    assert result.read_at is not None
    stored = db.query(UserNotification).filter(UserNotification.id == notification.id).one()
    assert stored.read_at is not None


def test_mark_notification_read_rejects_wrong_owner():
    db = _session()
    notification = _make_notification(db, token="tok-owner")

    with pytest.raises(HTTPException) as exc_info:
        notifications_module.mark_notification_read(
            notification_id=notification.id,
            request=_DummyRequest(),
            x_alert_token="tok-attacker",
            db=db,
        )

    assert exc_info.value.status_code == 404


def test_mark_all_notifications_read_updates_only_owner():
    db = _session()
    first = _make_notification(db, token="tok-owner", title="First")
    second = _make_notification(db, token="tok-owner", title="Second")
    other = _make_notification(db, token="tok-other", title="Other")

    result = notifications_module.mark_all_notifications_read(
        request=_DummyRequest(),
        x_alert_token="tok-owner",
        db=db,
    )

    assert result.updated == 2
    db.refresh(first)
    db.refresh(second)
    db.refresh(other)
    assert first.read_at is not None
    assert second.read_at is not None
    assert other.read_at is None
