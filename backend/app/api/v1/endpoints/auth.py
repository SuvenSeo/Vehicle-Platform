"""Environment-configured authentication with signed bearer tokens.

Accounts live in the AUTH_USERS env var (JSON list), tokens are HMAC-SHA256
signed with AUTH_TOKEN_SECRET. Passwords are bcrypt hashes only — legacy
unsalted SHA-256 entries are no longer accepted.

AUTH_USERS example:
    [{"email": "owner@example.com", "password_hash": "$2b$12$...",
      "name": "Owner", "plan": "enterprise", "subscription_status": "active"}]

Generate a password hash with:
    python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"

/api/v1/pro/* endpoints require a valid pro/enterprise token by default;
set PRO_ACCESS_ENFORCED=false only for local development.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional
import bcrypt

from fastapi import APIRouter, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.services.rate_limit import RateLimiter

router = APIRouter()

TOKEN_TTL_SECONDS_DEFAULT = 7 * 24 * 3600
SESSION_COOKIE_NAME = "mm_session"
ALLOWED_PLANS = {"free", "pro", "enterprise"}
ALLOWED_SUBSCRIPTION_STATUSES = {"none", "trialing", "active", "past_due", "canceled"}
PRO_PLANS = {"pro", "enterprise"}
ACTIVE_PRO_SUBSCRIPTION_STATUSES = {"active", "trialing"}

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


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=200)


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
        
        # If plain password is provided, hash it with bcrypt
        final_hash = password_hash or _hash_password(plain_password)
        
        users[email] = {
            "email": email,
            "password_hash": final_hash,
            "name": str(item.get("name") or email.split("@")[0]),
            "plan": plan if plan in ALLOWED_PLANS else "pro",
            "subscription_status": subscription_status
            if subscription_status in ALLOWED_SUBSCRIPTION_STATUSES
            else "active",
        }
    return users


def auth_is_configured() -> bool:
    return bool(_token_secret()) and bool(_configured_users())


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
    now: Optional[float] = None,
) -> tuple[str, int]:
    secret = _token_secret()
    expires_at = int((time.time() if now is None else now) + _token_ttl_seconds())
    normalized_subscription_status = str(subscription_status or "active").strip().lower()
    payload = _b64url_encode(
        json.dumps(
            {
                "email": email,
                "plan": plan,
                "subscription_status": normalized_subscription_status,
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
        "avatarInitials": initials,
    }


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
    bearer = (authorization or "").removeprefix("Bearer ").strip()
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


@router.post("/login", response_model=dict)
def login(payload: LoginRequest, request: Request, response: Response):
    _login_rate_limiter(request)

    if not auth_is_configured():
        raise HTTPException(status_code=503, detail="Authentication is not configured on this deployment.")

    email = payload.email.strip().lower()
    record = _configured_users().get(email)

    if not record or not _verify_password(payload.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token, expires_at = issue_token(record["email"], record["plan"], record["subscription_status"])
    _set_session_cookie(response, token, expires_at)
    return {
        "user": _user_response(record),
        "token": token,
        "expires_at": expires_at,
    }


@router.post("/logout", response_model=dict)
def logout(response: Response):
    _clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=dict)
def me(request: Request, authorization: Optional[str] = Header(default=None)):
    _me_rate_limiter(request)
    token = _extract_token(authorization, request)
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"email": payload.get("email"), "plan": payload.get("plan"), "exp": payload.get("exp")}


def pro_access_enforced() -> bool:
    """Server-side Pro gating is ON unless explicitly disabled.

    Secure by default: an unset or unrecognised PRO_ACCESS_ENFORCED value
    enforces the gate; set it to false/0/no/off only for local development.
    """
    return os.getenv("PRO_ACCESS_ENFORCED", "true").strip().lower() not in {"0", "false", "no", "off"}


def require_pro_access(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> None:
    """Gate for /pro/* — requires a valid pro/enterprise token unless
    PRO_ACCESS_ENFORCED=false explicitly opts out (local dev only).

    Accepts Authorization Bearer *or* the HttpOnly ``mm_session`` cookie.
    Mutating clients should still send Bearer (or another custom header) so
    cross-site cookie CSRF cannot alone unlock Pro writes.

    ``request`` must be a required FastAPI-injected ``Request`` (not Optional):
    Optional[Request]=None is treated as a body field and breaks app startup.
    """
    if not pro_access_enforced():
        return

    token = _extract_token(authorization, request)
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Pro access requires a valid session token.")
    if str(payload.get("plan") or "").lower() not in PRO_PLANS:
        raise HTTPException(status_code=403, detail="Pro subscription required.")
    subscription_status = str(
        payload.get("subscription_status") or payload.get("subscriptionStatus") or "active"
    ).lower()
    if subscription_status not in ACTIVE_PRO_SUBSCRIPTION_STATUSES:
        raise HTTPException(status_code=403, detail="Active Pro subscription required.")