"""Environment-configured authentication with signed bearer tokens.

Accounts live in the AUTH_USERS env var (JSON list), tokens are HMAC-SHA256
signed with AUTH_TOKEN_SECRET. Nothing is enabled unless both are set, so
existing deployments keep working untouched.

AUTH_USERS example:
    [{"email": "owner@example.com", "password_hash": "$2b$12$...",
      "name": "Owner", "plan": "enterprise", "subscription_status": "active"}]

Generate a password hash with:
    python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"

Set PRO_ACCESS_ENFORCED=true to require a valid pro/enterprise token on all
/api/v1/pro/* endpoints (default: off / public, matching prior behaviour).
"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional
import bcrypt

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.rate_limit import RateLimiter

router = APIRouter()

TOKEN_TTL_SECONDS_DEFAULT = 7 * 24 * 3600
ALLOWED_PLANS = {"free", "pro", "enterprise"}
ALLOWED_SUBSCRIPTION_STATUSES = {"none", "trialing", "active", "past_due"}
PRO_PLANS = {"pro", "enterprise"}

_login_rate_limiter = RateLimiter(
    max_requests=10,
    window_seconds=60,
    message="Too many sign-in attempts. Try again shortly.",
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
    try:
        # Check if the hash looks like a bcrypt hash
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        pass
    # Fallback to unsalted SHA-256 for backward-compatibility transition
    try:
        supplied_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(supplied_hash, hashed_password)
    except Exception:
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
        password_hash = str(item.get("password_hash") or item.get("password_sha256") or "").strip()
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


def issue_token(email: str, plan: str, *, now: Optional[float] = None) -> tuple[str, int]:
    secret = _token_secret()
    expires_at = int((time.time() if now is None else now) + _token_ttl_seconds())
    payload = _b64url_encode(
        json.dumps({"email": email, "plan": plan, "exp": expires_at}, separators=(",", ":")).encode()
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


@router.post("/login", response_model=dict)
def login(payload: LoginRequest, request: Request):
    _login_rate_limiter(request)

    if not auth_is_configured():
        raise HTTPException(status_code=503, detail="Authentication is not configured on this deployment.")

    email = payload.email.strip().lower()
    record = _configured_users().get(email)

    if not record or not _verify_password(payload.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token, expires_at = issue_token(record["email"], record["plan"])
    return {
        "user": _user_response(record),
        "token": token,
        "expires_at": expires_at,
    }



@router.get("/me", response_model=dict)
def me(authorization: Optional[str] = Header(default=None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"email": payload.get("email"), "plan": payload.get("plan"), "exp": payload.get("exp")}


def pro_access_enforced() -> bool:
    return os.getenv("PRO_ACCESS_ENFORCED", "").strip().lower() in {"1", "true", "yes", "on"}


def require_pro_access(authorization: Optional[str] = Header(default=None)) -> None:
    """Optional gate for /pro/* — enforced only when PRO_ACCESS_ENFORCED=true.

    Defaults to open so existing deployments without auth config keep
    functioning; flipping the flag turns Pro into a real server-side boundary.
    """
    if not pro_access_enforced():
        return

    token = (authorization or "").removeprefix("Bearer ").strip()
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Pro access requires a valid session token.")
    if str(payload.get("plan") or "").lower() not in PRO_PLANS:
        raise HTTPException(status_code=403, detail="Pro subscription required.")
