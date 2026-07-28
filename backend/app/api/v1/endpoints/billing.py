"""Billing webhook — upgrade/downgrade Motormila plans from Stripe (or compatible) events.

Requires BILLING_WEBHOOK_SECRET. Without it the endpoint returns 503.
This does not create Stripe Checkout sessions; wire your Stripe dashboard /
PayHere success hook to POST here after payment succeeds.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import (
    ALLOWED_PLANS,
    ALLOWED_SUBSCRIPTION_STATUSES,
    default_subscription_for_plan,
)
from db.models import PlatformUser
from db.session import SessionLocal

router = APIRouter()


class BillingPlanEvent(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    plan: str = Field(..., min_length=3, max_length=20)
    subscription_status: Optional[str] = Field(default=None, max_length=20)
    event_id: Optional[str] = Field(default=None, max_length=120)


def _webhook_secret() -> str:
    return os.getenv("BILLING_WEBHOOK_SECRET", "").strip()


def _verify_signature(raw_body: bytes, signature: Optional[str]) -> None:
    secret = _webhook_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="Billing webhook is not configured.")
    provided = (signature or "").strip()
    if provided.lower().startswith("sha256="):
        provided = provided.split("=", 1)[1].strip()
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid billing webhook signature.")


@router.post("/webhook")
async def billing_webhook(
    request: Request,
    x_motormila_signature: Optional[str] = Header(default=None, alias="X-Motormila-Signature"),
    stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature"),
):
    """Apply a plan change from a signed webhook body.

    Body JSON: ``{ "email", "plan", "subscription_status?", "event_id?" }``
    Signature: HMAC-SHA256 hex of the raw body in ``X-Motormila-Signature``
    (``sha256=<hex>`` also accepted). Stripe-Signature is ignored unless you
    terminate Stripe → Motormila in your own adapter; keep using our header.
    """
    del stripe_signature  # reserved for a future native Stripe verifier
    raw = await request.body()
    _verify_signature(raw, x_motormila_signature)

    try:
        parsed = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc

    event = BillingPlanEvent.model_validate(parsed)
    email = event.email.strip().lower()
    plan = event.plan.strip().lower()
    if plan not in ALLOWED_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan.")
    status = (event.subscription_status or default_subscription_for_plan(plan)).strip().lower()
    if status not in ALLOWED_SUBSCRIPTION_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid subscription_status.")

    db: Session = SessionLocal()
    try:
        user = db.query(PlatformUser).filter(PlatformUser.email == email).first()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found.")
        user.plan = plan
        user.subscription_status = status
        user.token_version = int(getattr(user, "token_version", 0) or 0) + 1
        db.commit()
        return {
            "ok": True,
            "email": email,
            "plan": plan,
            "subscriptionStatus": status,
            "eventId": event.event_id,
            "tokenVersion": int(user.token_version or 0),
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Checkout intent — surface a checkout URL or contact-sales fallback
# ---------------------------------------------------------------------------

_CONTACT_EMAIL_FALLBACK = "s.seoras@rgu.ac.uk"


def _checkout_url() -> Optional[str]:
    """Return the first configured checkout URL, or None."""
    for env_var in ("BILLING_CHECKOUT_URL", "STRIPE_CHECKOUT_URL", "PAYHERE_CHECKOUT_URL"):
        url = os.getenv(env_var, "").strip()
        if url:
            return url
    return None


def _contact_email() -> str:
    return os.getenv("BILLING_CONTACT_EMAIL", _CONTACT_EMAIL_FALLBACK).strip()


class CheckoutIntentRequest(BaseModel):
    plan: str = Field(..., min_length=1, max_length=30, description="Requested plan: 'pro' or 'dealer'")


class CheckoutIntentResponse(BaseModel):
    provider: Literal["manual", "payhere", "stripe"]
    checkout_url: Optional[str] = None
    message: str


@router.post("/checkout-intent", response_model=CheckoutIntentResponse)
def checkout_intent(body: CheckoutIntentRequest) -> CheckoutIntentResponse:
    """Return a checkout URL for the requested plan upgrade.

    Reads environment variables in priority order:
      BILLING_CHECKOUT_URL > STRIPE_CHECKOUT_URL > PAYHERE_CHECKOUT_URL

    When none are set, returns a "contact sales" message so the frontend can
    show a mailto link instead of a broken checkout flow.
    """
    url = _checkout_url()
    if url:
        env_vars = {k: os.getenv(k, "") for k in ("STRIPE_CHECKOUT_URL", "PAYHERE_CHECKOUT_URL")}
        if env_vars.get("STRIPE_CHECKOUT_URL"):
            provider: Literal["manual", "payhere", "stripe"] = "stripe"
        elif env_vars.get("PAYHERE_CHECKOUT_URL"):
            provider = "payhere"
        else:
            provider = "manual"
        return CheckoutIntentResponse(
            provider=provider,
            checkout_url=url,
            message=f"Redirecting to {provider} checkout for {body.plan} plan.",
        )

    contact = _contact_email()
    return CheckoutIntentResponse(
        provider="manual",
        checkout_url=None,
        message=f"Online checkout is not yet configured. To upgrade to the {body.plan} plan, email {contact} and we will set up your seat manually.",
    )
