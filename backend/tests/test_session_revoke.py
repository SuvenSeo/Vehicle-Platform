"""Live session revalidation + token_version revocation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.v1.endpoints import auth
from db.models import Base, PlatformUser

_BCRYPT_HASH = auth._hash_password("correct-horse")


class DummyRequest:
    method = "GET"
    headers = {"user-agent": "pytest"}
    client = type("Client", (), {"host": "127.0.0.1"})()
    cookies: dict = {}


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_logout_bumps_token_version_and_rejects_old_token(monkeypatch):
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")
    db = _session()
    user = PlatformUser(
        email="owner@example.com",
        password_hash=_BCRYPT_HASH,
        name="Owner",
        plan="pro",
        subscription_status="active",
        role="admin",
        is_active=True,
        token_version=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token, _ = auth.issue_token(
        user.email,
        user.plan,
        user.subscription_status,
        role=user.role,
        token_version=user.token_version,
    )
    assert auth.require_pro_access(request=DummyRequest(), authorization=f"Bearer {token}", db=db) is None

    req = DummyRequest()
    req.cookies = {auth.SESSION_COOKIE_NAME: token}
    auth.logout(Response(), req, authorization=f"Bearer {token}", db=db)

    db.refresh(user)
    assert user.token_version == 1

    with pytest.raises(HTTPException) as exc:
        auth.require_pro_access(request=DummyRequest(), authorization=f"Bearer {token}", db=db)
    assert exc.value.status_code == 401


def test_plan_downgrade_blocks_pro_even_if_jwt_still_says_pro(monkeypatch):
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret")
    monkeypatch.setenv("PRO_ACCESS_ENFORCED", "true")
    db = _session()
    user = PlatformUser(
        email="pro@example.com",
        password_hash=_BCRYPT_HASH,
        name="Pro User",
        plan="pro",
        subscription_status="active",
        role="user",
        is_active=True,
        token_version=0,
    )
    db.add(user)
    db.commit()

    token, _ = auth.issue_token("pro@example.com", "pro", "active", role="user", token_version=0)
    assert auth.require_pro_access(request=DummyRequest(), authorization=f"Bearer {token}", db=db) is None

    user.plan = "free"
    user.subscription_status = "none"
    db.commit()

    with pytest.raises(HTTPException) as exc:
        auth.require_pro_access(request=DummyRequest(), authorization=f"Bearer {token}", db=db)
    assert exc.value.status_code == 403
