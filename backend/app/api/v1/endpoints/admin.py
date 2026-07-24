"""Admin console API — invites, user plans, and platform analytics.

All routes require an authenticated admin (platform_users.role=admin or
AUTH_USERS entry with role=admin).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import (
    ALLOWED_PLANS,
    ALLOWED_ROLES,
    default_subscription_for_plan,
    generate_invite_token,
    invite_expiry,
    require_admin_access,
    resolve_user_record,
)
from app.services.invite_email import try_send_invite_email
from db.models import (
    CarListing,
    DealerProfile,
    PlatformUser,
    ScrapeRun,
    UserFeedback,
    UserInvite,
    live_listing_filter,
)
from db.schema_patches import heal_platform_users_schema
from db.session import get_db

router = APIRouter()


class InviteCreateRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    plan: str = Field(default="free", max_length=20)
    role: str = Field(default="user", max_length=20)


class UserUpdateRequest(BaseModel):
    plan: Optional[str] = Field(default=None, max_length=20)
    subscription_status: Optional[str] = Field(default=None, max_length=20)
    role: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None
    name: Optional[str] = Field(default=None, max_length=120)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _invite_response(invite: UserInvite, *, email_sent: bool | None = None) -> dict:
    payload = {
        "id": invite.id,
        "email": invite.email,
        "plan": invite.plan,
        "role": invite.role,
        "status": invite.status,
        "token": invite.token,
        "signupPath": f"/sign-up?token={invite.token}",
        "invitedByEmail": invite.invited_by_email,
        "expiresAt": invite.expires_at.isoformat() if invite.expires_at else None,
        "acceptedAt": invite.accepted_at.isoformat() if invite.accepted_at else None,
        "createdAt": invite.created_at.isoformat() if invite.created_at else None,
    }
    if email_sent is not None:
        payload["emailSent"] = email_sent
    return payload


def _dispatch_invite_email(invite: UserInvite, *, invited_by: str) -> bool:
    return try_send_invite_email(
        to_email=invite.email,
        plan=invite.plan,
        token=invite.token,
        invited_by=invited_by,
    )


def _user_row_response(user: PlatformUser) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "plan": user.plan,
        "subscriptionStatus": user.subscription_status,
        "role": user.role,
        "isActive": bool(user.is_active),
        "invitedByEmail": user.invited_by_email,
        "lastLoginAt": user.last_login_at.isoformat() if user.last_login_at else None,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/overview", response_model=dict)
def admin_overview(
    admin: dict = Depends(require_admin_access),
    db: Session = Depends(get_db),
):
    del admin  # auth side-effect only
    total_listings = db.query(func.count(CarListing.id)).scalar() or 0
    live_listings = (
        db.query(func.count(CarListing.id)).filter(live_listing_filter()).scalar() or 0
    )
    users_total = db.query(func.count(PlatformUser.id)).scalar() or 0
    users_free = (
        db.query(func.count(PlatformUser.id)).filter(PlatformUser.plan == "free").scalar() or 0
    )
    users_pro = (
        db.query(func.count(PlatformUser.id))
        .filter(PlatformUser.plan.in_(("pro", "enterprise")))
        .scalar()
        or 0
    )
    users_admin = (
        db.query(func.count(PlatformUser.id)).filter(PlatformUser.role == "admin").scalar() or 0
    )
    invites_pending = (
        db.query(func.count(UserInvite.id)).filter(UserInvite.status == "pending").scalar() or 0
    )
    feedback_open = (
        db.query(func.count(UserFeedback.id))
        .filter(UserFeedback.status.in_(("new", "open")))
        .scalar()
        or 0
    )
    dealers_verified = (
        db.query(func.count(DealerProfile.id))
        .filter(DealerProfile.status == "verified")
        .scalar()
        or 0
    )

    recent_scrapes = (
        db.query(ScrapeRun)
        .order_by(ScrapeRun.started_at.desc())
        .limit(8)
        .all()
    )
    scrape_payload = [
        {
            "id": run.id,
            "source": run.source,
            "status": run.status,
            "listingsFound": run.listings_found or 0,
            "listingsNew": run.listings_new or 0,
            "startedAt": run.started_at.isoformat() if run.started_at else None,
            "finishedAt": run.finished_at.isoformat() if run.finished_at else None,
            "errorMessage": run.error_message,
        }
        for run in recent_scrapes
    ]

    top_makes = (
        db.query(CarListing.make, func.count(CarListing.id).label("count"))
        .filter(live_listing_filter())
        .group_by(CarListing.make)
        .order_by(func.count(CarListing.id).desc())
        .limit(8)
        .all()
    )

    return {
        "listings": {
            "total": int(total_listings),
            "live": int(live_listings),
        },
        "users": {
            "total": int(users_total),
            "free": int(users_free),
            "pro": int(users_pro),
            "admins": int(users_admin),
        },
        "invites": {"pending": int(invites_pending)},
        "feedback": {"open": int(feedback_open)},
        "dealers": {"verified": int(dealers_verified)},
        "recentScrapes": scrape_payload,
        "topMakes": [{"make": make, "count": int(count)} for make, count in top_makes],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/users", response_model=dict)
def list_users(
    admin: dict = Depends(require_admin_access),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    del admin
    try:
        heal_platform_users_schema(db)
        total = db.query(func.count(PlatformUser.id)).scalar() or 0
        rows = (
            db.query(PlatformUser)
            .order_by(PlatformUser.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return {"total": int(total), "users": [_user_row_response(row) for row in rows]}
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        # One more heal+retry for the common UndefinedColumn race.
        try:
            heal_platform_users_schema(db)
            total = db.query(func.count(PlatformUser.id)).scalar() or 0
            rows = (
                db.query(PlatformUser)
                .order_by(PlatformUser.id.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            return {"total": int(total), "users": [_user_row_response(row) for row in rows]}
        except Exception as retry_exc:
            try:
                db.rollback()
            except Exception:
                pass
            raise HTTPException(
                status_code=500,
                detail=f"admin_users_failed: {type(retry_exc).__name__}: {retry_exc}",
            ) from retry_exc


@router.patch("/users/{user_id}", response_model=dict)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    admin: dict = Depends(require_admin_access),
    db: Session = Depends(get_db),
):
    user = db.query(PlatformUser).filter(PlatformUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.plan is not None:
        plan = payload.plan.strip().lower()
        if plan not in ALLOWED_PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan.")
        user.plan = plan
        if payload.subscription_status is None:
            user.subscription_status = default_subscription_for_plan(plan)

    if payload.subscription_status is not None:
        status = payload.subscription_status.strip().lower()
        user.subscription_status = status

    if payload.role is not None:
        role = payload.role.strip().lower()
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role.")
        # Prevent accidental self-demotion lockout when you're the only admin.
        if user.email == admin["email"] and role != "admin":
            other_admins = (
                db.query(func.count(PlatformUser.id))
                .filter(PlatformUser.role == "admin", PlatformUser.id != user.id)
                .scalar()
                or 0
            )
            if other_admins < 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove the last admin role from your own account.",
                )
        user.role = role

    if payload.is_active is not None:
        if user.email == admin["email"] and payload.is_active is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own admin account.")
        user.is_active = payload.is_active

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty.")
        user.name = name

    # Any privilege / identity change invalidates outstanding sessions.
    user.token_version = int(getattr(user, "token_version", 0) or 0) + 1

    db.commit()
    db.refresh(user)
    return _user_row_response(user)


@router.get("/invites", response_model=dict)
def list_invites(
    admin: dict = Depends(require_admin_access),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    del admin
    query = db.query(UserInvite)
    if status:
        query = query.filter(UserInvite.status == status.strip().lower())
    rows = query.order_by(UserInvite.created_at.desc()).limit(limit).all()
    return {"invites": [_invite_response(row) for row in rows]}


@router.post("/invites", response_model=dict)
def create_invite(
    payload: InviteCreateRequest,
    admin: dict = Depends(require_admin_access),
    db: Session = Depends(get_db),
):
    email = _normalize_email(payload.email)
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    plan = payload.plan.strip().lower()
    if plan not in ALLOWED_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan.")

    role = payload.role.strip().lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role.")

    existing_user = resolve_user_record(email, db)
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    pending = (
        db.query(UserInvite)
        .filter(UserInvite.email == email, UserInvite.status == "pending")
        .first()
    )
    if pending is not None:
        # Refresh token + plan on re-invite instead of duplicating.
        pending.plan = plan
        pending.role = role
        pending.token = generate_invite_token()
        pending.expires_at = invite_expiry()
        pending.invited_by_email = admin["email"]
        db.commit()
        db.refresh(pending)
        sent = _dispatch_invite_email(pending, invited_by=admin["email"])
        return _invite_response(pending, email_sent=sent)

    invite = UserInvite(
        email=email,
        plan=plan,
        role=role,
        token=generate_invite_token(),
        status="pending",
        invited_by_email=admin["email"],
        expires_at=invite_expiry(),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    sent = _dispatch_invite_email(invite, invited_by=admin["email"])
    return _invite_response(invite, email_sent=sent)


@router.delete("/invites/{invite_id}", response_model=dict)
def revoke_invite(
    invite_id: int,
    admin: dict = Depends(require_admin_access),
    db: Session = Depends(get_db),
):
    del admin
    invite = db.query(UserInvite).filter(UserInvite.id == invite_id).first()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.status == "accepted":
        raise HTTPException(status_code=400, detail="Accepted invites cannot be revoked.")
    invite.status = "revoked"
    db.commit()
    return {"ok": True, "id": invite_id, "status": "revoked"}
