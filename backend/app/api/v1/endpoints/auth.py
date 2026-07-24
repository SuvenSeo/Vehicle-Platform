"""Authentication with signed bearer tokens.

Accounts resolve from (in order):
  1. ``platform_users`` DB table (invite-provisioned accounts)
  2. ``AUTH_USERS`` env JSON (bootstrap / legacy deployments)

Tokens are HMAC-SHA256 signed with AUTH_TOKEN_SECRET. Passwords are bcrypt
hashes only — legacy unsalted SHA-256 entries are no longer accepted.

AUTH_USERS example:
    [{"email": "owner@example.com", "password_hash": "$2b$12$...",
      "name": "Owner", "plan": "enterprise", "subscription_status": "active",
      "role": "admin"}]

Generate a password hash with:
    python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"

/api/v1/pro/* endpoints require a valid pro/enterprise token by default;
set PRO_ACCESS_ENFORCED=false only for local development.

App-wide API gating uses APP_ACCESS_ENFORCED (default true, same opt-out).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.rate_limit import RateLimiter
from db.models import PlatformUser, UserInvite
from db.session import get_db

router = APIRouter()

TOKEN_TTL_SECONDS_DEFAULT = 24 * 3600  # 24h — shorter sessions; override with AUTH_TOKEN_TTL_SECONDS
INVITE_TTL_DAYS_DEFAULT = 14
SESSION_COOKIE_NAME = "mm_session"
ALLOWED_PLANS = {"free", "pro", "enterprise"}
ALLOWED_SUBSCRIPTION_STATUSES = {"none", "trialing", "active", "past_due", "canceled"}
ALLOWED_ROLES = {"user", "admin"}
PRO_PLANS = {"pro", "enterprise"}
ACTIVE_PRO_SUBSCRIPTION_STATUSES = {"active", "trialing"}


def _session_or_none(db: object) -> Optional[Session]:
    """FastAPI injects Session; direct unit calls may pass Depends(...) or omit db."""
    return db if isinstance(db, Session) else None

_login_rate_limiter = RateLimiter(
    max_requests=10,
    window_seconds=60,
    message="Too many sign-in attempts. Try again shortly.",
)
_me_rate_limiter = RateLimiter(
    max_requests=60,
    window_seconds=60,
    message="Too many account lookups. Try again shortly.",
)
_signup_rate_limiter = RateLimiter(
    max_requests=10,
    window_seconds=60,
    message="Too many sign-up attempts. Try again shortly.",
)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=200)


class SignupRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)
    name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=8, max_length=200)


def _token_secret() -> str:
    return os.getenv("AUTH_TOKEN_SECRET", "").strip()


def _token_ttl_seconds() -> int:
    raw = os.getenv("AUTH_TOKEN_TTL_SECONDS", "").strip()
    try:
        parsed = int(raw)
        if parsed > 0:
            return parsed
    except ValueError:
        pass
    return TOKEN_TTL_SECONDS_DEFAULT


def _invite_ttl_days() -> int:
    raw = os.getenv("AUTH_INVITE_TTL_DAYS", "").strip()
    try:
        parsed = int(raw)
        if parsed > 0:
            return parsed
    except ValueError:
        pass
    return INVITE_TTL_DAYS_DEFAULT


def _hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password(plain_password: str, hashed_password: str) -> bool:
    if not (hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$")):
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _configured_users() -> dict[str, dict]:
    raw = os.getenv("AUTH_USERS", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, list):
        return {}

    users: dict[str, dict] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        email = str(item.get("email") or "").strip().lower()
        password_hash = str(item.get("password_hash") or "").strip()
        plain_password = str(item.get("password") or "")
        if not email or (not password_hash and not plain_password):
            continue

        plan = str(item.get("plan") or "pro").strip().lower()
        subscription_status = str(item.get("subscription_status") or "active").strip().lower()
        role = str(item.get("role") or "user").strip().lower()

        final_hash = password_hash or _hash_password(plain_password)

        users[email] = {
            "email": email,
            "password_hash": final_hash,
            "name": str(item.get("name") or email.split("@")[0]),
            "plan": plan if plan in ALLOWED_PLANS else "pro",
            "subscription_status": subscription_status
            if subscription_status in ALLOWED_SUBSCRIPTION_STATUSES
            else "active",
            "role": role if role in ALLOWED_ROLES else "user",
            "is_active": True,
            "token_version": 0,
            "source": "env",
        }
    return users


def auth_is_configured() -> bool:
    """Auth works when a signing secret is set and at least one account source exists.

    Account sources: AUTH_USERS env, or any row in platform_users (checked at
    request time). Secret alone is enough for invite validation / signup once
    an admin has been seeded via AUTH_USERS or a prior DB user.
    """
    return bool(_token_secret())


def auth_has_login_accounts(db: Optional[Session] = None) -> bool:
    if _configured_users():
        return True
    if db is None:
        return False
    try:
        return db.query(PlatformUser.id).filter(PlatformUser.is_active.is_(True)).first() is not None
    except Exception:
        return False


def _b64url_encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def issue_token(
    email: str,
    plan: str,
    subscription_status: str = "active",
    *,
    role: str = "user",
    token_version: int = 0,
    now: Optional[float] = None,
) -> tuple[str, int]:
    secret = _token_secret()
    expires_at = int((time.time() if now is None else now) + _token_ttl_seconds())
    normalized_subscription_status = str(subscription_status or "active").strip().lower()
    normalized_role = str(role or "user").strip().lower()
    if normalized_role not in ALLOWED_ROLES:
        normalized_role = "user"
    payload = _b64url_encode(
        json.dumps(
            {
                "email": email,
                "plan": plan,
                "subscription_status": normalized_subscription_status,
                "role": normalized_role,
                "tv": int(token_version or 0),
                "exp": expires_at,
            },
            separators=(",", ":"),
        ).encode()
    )
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}", expires_at


def verify_token(token: str, *, now: Optional[float] = None) -> Optional[dict]:
    secret = _token_secret()
    if not secret or not token or "." not in token:
        return None

    payload_part, _, signature = token.partition(".")
    expected = hmac.new(secret.encode(), payload_part.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None

    try:
        payload = json.loads(_b64url_decode(payload_part))
    except (ValueError, json.JSONDecodeError):
        return None

    if not isinstance(payload, dict):
        return None
    if float(payload.get("exp") or 0) < (time.time() if now is None else now):
        return None
    return payload


def _user_response(record: dict) -> dict:
    name = record["name"]
    initials = "".join(part[0] for part in name.split() if part)[:3].upper() or "AU"
    return {
        "email": record["email"],
        "name": name,
        "plan": record["plan"],
        "subscriptionStatus": record["subscription_status"],
        "role": record.get("role") or "user",
        "avatarInitials": initials,
    }


def _platform_user_to_record(user: PlatformUser) -> dict:
    return {
        "email": user.email,
        "password_hash": user.password_hash,
        "name": user.name,
        "plan": user.plan,
        "subscription_status": user.subscription_status,
        "role": user.role,
        "is_active": bool(user.is_active),
        "token_version": int(getattr(user, "token_version", 0) or 0),
        "source": "db",
        "id": user.id,
    }


def bump_token_version(db: Session, *, email: Optional[str] = None, user_id: Optional[int] = None) -> int:
    """Invalidate outstanding JWTs for a platform user by bumping token_version."""
    query = db.query(PlatformUser)
    if user_id is not None:
        query = query.filter(PlatformUser.id == user_id)
    elif email:
        query = query.filter(PlatformUser.email == email.strip().lower())
    else:
        return 0
    row = query.first()
    if row is None:
        return 0
    row.token_version = int(getattr(row, "token_version", 0) or 0) + 1
    db.commit()
    db.refresh(row)
    return int(row.token_version or 0)


def resolve_live_session(payload: dict, db: Optional[Session] = None) -> dict:
    """Re-read plan/role/active from the account store; reject revoked/inactive sessions.

    Never trusts JWT plan/role alone once an account row exists (or AUTH_USERS entry).
    """
    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required.")

    record = resolve_user_record(email, db)
    if record is None:
        raise HTTPException(status_code=401, detail="Session is no longer valid.")

    token_tv = int(payload.get("tv") or 0)
    record_tv = int(record.get("token_version") or 0)
    # Env-only accounts have no token_version until synced; treat missing as 0.
    if record.get("source") == "db" and token_tv != record_tv:
        raise HTTPException(status_code=401, detail="Session has been revoked.")

    return {
        "email": email,
        "plan": record["plan"],
        "subscription_status": record["subscription_status"],
        "role": record.get("role") or "user",
        "token_version": record_tv,
        "name": record.get("name") or email.split("@")[0],
        "id": record.get("id"),
        "source": record.get("source"),
    }


def resolve_user_record(email: str, db: Optional[Session] = None) -> Optional[dict]:
    """Resolve an account by email from DB first, then AUTH_USERS env."""
    normalized = email.strip().lower()
    if not normalized:
        return None

    if db is not None:
        try:
            row = db.query(PlatformUser).filter(PlatformUser.email == normalized).first()
            if row is not None:
                if not row.is_active:
                    return None
                return _platform_user_to_record(row)
        except Exception:
            # Table may not exist yet during early migrate/tests — fall through.
            pass

    return _configured_users().get(normalized)


def sync_env_user_to_db(record: dict, db: Session) -> Optional[PlatformUser]:
    """Upsert an AUTH_USERS bootstrap account into platform_users."""
    email = record["email"]
    existing = db.query(PlatformUser).filter(PlatformUser.email == email).first()
    if existing is not None:
        return existing
    user = PlatformUser(
        email=email,
        password_hash=record["password_hash"],
        name=record["name"],
        plan=record["plan"],
        subscription_status=record["subscription_status"],
        role=record.get("role") or "user",
        is_active=True,
        invited_by_email="system:AUTH_USERS",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def default_subscription_for_plan(plan: str) -> str:
    if plan in PRO_PLANS:
        return "active"
    return "none"


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def invite_expiry(*, now: Optional[datetime] = None) -> datetime:
    base = now or datetime.now(timezone.utc)
    return base + timedelta(days=_invite_ttl_days())


def _cookie_secure() -> bool:
    return os.getenv("AUTH_COOKIE_SECURE", "true").strip().lower() not in {"0", "false", "no", "off"}


def _cookie_samesite() -> str:
    raw = os.getenv("AUTH_COOKIE_SAMESITE", "none").strip().lower()
    if raw in {"lax", "strict", "none"}:
        return raw
    return "none"


def _extract_token(
    authorization: Optional[str] = None,
    request: Optional[Request] = None,
) -> str:
    """Prefer Authorization Bearer, then fall back to the HttpOnly session cookie."""
    # Direct unit calls may pass FastAPI Header() defaults instead of None/str.
    auth_value = authorization if isinstance(authorization, str) else None
    bearer = (auth_value or "").removeprefix("Bearer ").strip()
    if bearer:
        return bearer
    if request is not None:
        cookie = str(request.cookies.get(SESSION_COOKIE_NAME) or "").strip()
        if cookie:
            return cookie
    return ""


def _set_session_cookie(response: Response, token: str, expires_at: int) -> None:
    max_age = max(60, int(expires_at - time.time()))
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite=_cookie_samesite(),
        max_age=max_age,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=_cookie_secure(),
        httponly=True,
        samesite=_cookie_samesite(),
    )


def _issue_login_response(record: dict, response: Response, db: Optional[Session] = None) -> dict:
    session = _session_or_none(db)
    if session is not None and record.get("source") == "env":
        try:
            synced = sync_env_user_to_db(record, session)
            if synced is not None:
                record = _platform_user_to_record(synced)
        except Exception:
            session.rollback()

    if session is not None and record.get("id"):
        try:
            row = session.query(PlatformUser).filter(PlatformUser.id == record["id"]).first()
            if row is not None:
                row.last_login_at = datetime.now(timezone.utc)
                session.commit()
                record = _platform_user_to_record(row)
        except Exception:
            session.rollback()

    token, expires_at = issue_token(
        record["email"],
        record["plan"],
        record["subscription_status"],
        role=record.get("role") or "user",
        token_version=int(record.get("token_version") or 0),
    )
    _set_session_cookie(response, token, expires_at)
    return {
        "user": _user_response(record),
        "token": token,
        "expires_at": expires_at,
    }


@router.post("/login", response_model=dict)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Optional[Session] = Depends(get_db),
):
    _login_rate_limiter(request)

    if not auth_is_configured():
        raise HTTPException(status_code=503, detail="Authentication is not configured on this deployment.")

    email = payload.email.strip().lower()
    record = resolve_user_record(email, _session_or_none(db))

    if not record or not _verify_password(payload.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return _issue_login_response(record, response, db)


@router.post("/signup", response_model=dict)
def signup(
    payload: SignupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Complete an admin invite: create platform_users row and sign the user in."""
    _signup_rate_limiter(request)

    if not auth_is_configured():
        raise HTTPException(status_code=503, detail="Authentication is not configured on this deployment.")
    if db is None:
        raise HTTPException(status_code=503, detail="Database is required for invite signup.")

    token = payload.token.strip()
    invite = db.query(UserInvite).filter(UserInvite.token == token).first()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.status != "pending":
        raise HTTPException(status_code=410, detail="Invite is no longer valid.")

    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired.")

    email = invite.email.strip().lower()
    existing = db.query(PlatformUser).filter(PlatformUser.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    plan = invite.plan if invite.plan in ALLOWED_PLANS else "free"
    role = invite.role if invite.role in ALLOWED_ROLES else "user"
    subscription_status = default_subscription_for_plan(plan)
    name = payload.name.strip() or email.split("@")[0]

    user = PlatformUser(
        email=email,
        password_hash=_hash_password(payload.password),
        name=name,
        plan=plan,
        subscription_status=subscription_status,
        role=role,
        is_active=True,
        invited_by_email=invite.invited_by_email,
        last_login_at=datetime.now(timezone.utc),
    )
    invite.status = "accepted"
    invite.accepted_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)

    record = _platform_user_to_record(user)
    return _issue_login_response(record, response, db)


@router.get("/invite/{token}", response_model=dict)
def invite_preview(token: str, db: Session = Depends(get_db)):
    """Public preview of a pending invite (no secrets)."""
    invite = db.query(UserInvite).filter(UserInvite.token == token.strip()).first()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.status != "pending":
        raise HTTPException(status_code=410, detail="Invite is no longer valid.")

    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired.")

    return {
        "email": invite.email,
        "plan": invite.plan,
        "expiresAt": expires_at.isoformat(),
    }


@router.post("/logout", response_model=dict)
def logout(
    response: Response,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Optional[Session] = Depends(get_db),
):
    """Clear cookie and revoke the current token version when a DB user is known."""
    token = _extract_token(authorization, request)
    payload = verify_token(token)
    session = _session_or_none(db)
    if payload is not None and session is not None:
        email = str(payload.get("email") or "").strip().lower()
        if email:
            try:
                bump_token_version(session, email=email)
            except Exception:
                session.rollback()
    _clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=dict)
def me(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Optional[Session] = Depends(get_db),
):
    _me_rate_limiter(request)
    token = _extract_token(authorization, request)
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    live = resolve_live_session(payload, _session_or_none(db))
    return _user_response(
        {
            "email": live["email"],
            "name": live["name"],
            "plan": live["plan"],
            "subscription_status": live["subscription_status"],
            "role": live["role"],
        }
    )


def pro_access_enforced() -> bool:
    """Server-side Pro gating is ON unless explicitly disabled.

    Secure by default: an unset or unrecognised PRO_ACCESS_ENFORCED value
    enforces the gate; set it to false/0/no/off only for local development.
    """
    return os.getenv("PRO_ACCESS_ENFORCED", "true").strip().lower() not in {"0", "false", "no", "off"}


def app_access_enforced() -> bool:
    """Require a signed-in session for protected product APIs.

    Secure by default (same pattern as Pro). Opt out with APP_ACCESS_ENFORCED=false
    for local development / open public demos.
    """
    return os.getenv("APP_ACCESS_ENFORCED", "true").strip().lower() not in {"0", "false", "no", "off"}


def _cors_allowed_origins() -> set[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        return {origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()}
    return {
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://motormila.vercel.app",
        "https://vehicle-platform-one.vercel.app",
        "https://vehicle-platform-one-suvenseoras-projects.vercel.app",
    }


def _request_origin(request: Request) -> Optional[str]:
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    if origin:
        return origin
    referer = (request.headers.get("referer") or "").strip()
    if not referer:
        return None
    try:
        parsed = urlparse(referer)
        if not parsed.scheme or not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    except Exception:
        return None


def _is_unsafe_method(request: Request) -> bool:
    return str(getattr(request, "method", "GET") or "GET").upper() in {
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
    }


def get_current_auth_payload(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Optional[Session] = Depends(get_db),
) -> dict:
    token = _extract_token(authorization, request)
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return resolve_live_session(payload, _session_or_none(db))


def require_authenticated(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Optional[Session] = Depends(get_db),
) -> Optional[dict]:
    """Gate for product APIs when APP_ACCESS_ENFORCED is on."""
    if not app_access_enforced():
        return None
    return get_current_auth_payload(request, authorization, db)


def require_admin_access(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Require an authenticated admin from the live account store (not JWT role alone)."""
    live = get_current_auth_payload(request, authorization, db)
    if str(live.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return {
        "email": live["email"],
        "plan": live["plan"],
        "role": "admin",
        "subscription_status": live["subscription_status"],
    }


def require_pro_access(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Optional[Session] = Depends(get_db),
) -> None:
    """Gate for /pro/* — requires a valid pro/enterprise token unless
    PRO_ACCESS_ENFORCED=false explicitly opts out (local dev only).

    Accepts Authorization Bearer *or* the HttpOnly ``mm_session`` cookie for
    safe (GET) methods. Mutating methods require a Bearer token AND an Origin
    (or Referer) in the CORS allowlist so cookie-only CSRF cannot unlock Pro writes.

    Plan/status are re-read from the live account store so downgrades take effect
    immediately (JWT claims alone are not trusted).
    """
    if not pro_access_enforced():
        return

    unsafe = _is_unsafe_method(request)
    auth_value = authorization if isinstance(authorization, str) else None
    bearer = (auth_value or "").removeprefix("Bearer ").strip()
    if unsafe and not bearer:
        raise HTTPException(
            status_code=403,
            detail="Pro writes require an Authorization Bearer token (cookie alone is not accepted).",
        )

    if unsafe:
        origin = _request_origin(request)
        allowed = _cors_allowed_origins()
        if origin is None or origin not in allowed:
            raise HTTPException(status_code=403, detail="Pro writes require a trusted Origin.")

    token = _extract_token(authorization, request)
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Pro access requires a valid session token.")

    live = resolve_live_session(payload, _session_or_none(db))
    if str(live.get("plan") or "").lower() not in PRO_PLANS:
        raise HTTPException(status_code=403, detail="Pro subscription required.")
    subscription_status = str(live.get("subscription_status") or "active").lower()
    if subscription_status not in ACTIVE_PRO_SUBSCRIPTION_STATUSES:
        raise HTTPException(status_code=403, detail="Active Pro subscription required.")
