import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from db.session import get_db
from .endpoints import admin, alerts, auth, b2b, billing, calculators, chat, dealer, events, ev, feedback, listings, market, notifications, pipeline, pro, seo, stats, vehicles
from .endpoints.auth import require_authenticated, require_pro_access

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
# Product data routes require a signed-in session when APP_ACCESS_ENFORCED=true.
_app_gate = [Depends(require_authenticated)]


def _normalize_browse_path(value: str) -> str:
    return "/" + str(value or "").strip().rstrip("/").lstrip("/")


# Public-browse allowlist: safe GET reads stay open for anonymous visitors
# even when APP_ACCESS_ENFORCED=true / PRO_ACCESS_ENFORCED=true.
# /pro/* stays fully gated via require_pro_access below; POST /alerts and
# /dealer/* stay gated via _app_gate.
_PUBLIC_BROWSE_PATHS = frozenset(
    _normalize_browse_path(path)
    for path in {
        "/api/v1/listings",
        "/api/v1/listings/price-drops",
        "/api/v1/stats/summary",
        "/api/v1/stats/district-prices",
        "/api/v1/stats/district-velocity",
        "/api/v1/stats/trends",
    }
)

# Detail + read-only sub-resources opened by B2-A (numeric id only so that
# /listings/makes, /listings/sources, /listings/estimate stay gated).
_LISTING_DETAIL_RE = re.compile(r"^/api/v1/listings/\d+$")
_LISTING_SUB_RE = re.compile(r"^/api/v1/listings/\d+/(similar|price-history|fmv)$")


def _is_public_browse_path(path: str) -> bool:
    """Exact allowlist plus B2-A read-only prefixes (GET only by caller)."""
    if path in _PUBLIC_BROWSE_PATHS:
        return True
    if _LISTING_DETAIL_RE.match(path) or _LISTING_SUB_RE.match(path):
        return True
    if path == "/api/v1/ev" or path.startswith("/api/v1/ev/"):
        return True
    if path == "/api/v1/market" or path.startswith("/api/v1/market/"):
        return True
    return False


def require_app_access_or_public_browse(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    """App gate with a public-browse exemption for allowlisted safe reads."""
    if request.method.upper() == "GET" and _is_public_browse_path(_normalize_browse_path(request.url.path)):
        return None
    return require_authenticated(request, authorization, db)


_public_browse_gate = [Depends(require_app_access_or_public_browse)]
api_router.include_router(listings.router, prefix="/listings", tags=["listings"], dependencies=_public_browse_gate)
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"], dependencies=_app_gate)
api_router.include_router(ev.router, prefix="/ev", tags=["ev"], dependencies=_public_browse_gate)
api_router.include_router(stats.router, prefix="/stats", tags=["stats"], dependencies=_public_browse_gate)
api_router.include_router(calculators.router, prefix="/calculators", tags=["calculators"], dependencies=_app_gate)
# Pro endpoints become a real server-side boundary when PRO_ACCESS_ENFORCED=true.
api_router.include_router(pro.router, prefix="/pro", tags=["pro"], dependencies=[Depends(require_pro_access)])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"], dependencies=_app_gate)
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"], dependencies=_app_gate)
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(market.router, prefix="/market", tags=["market"], dependencies=_public_browse_gate)
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"], dependencies=_app_gate)
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"], dependencies=_app_gate)
api_router.include_router(dealer.router, prefix="/dealer", tags=["dealer"], dependencies=_app_gate)
api_router.include_router(b2b.router, prefix="/b2b", tags=["b2b"])
# Public write: rate-limited analytics events (funnel tracking, no auth required).
api_router.include_router(events.router, prefix="/events", tags=["events"])
# SEO hub sitemaps + route manifest: unauthenticated crawler reads (safe GET,
# aggregate/distinct queries only). No auth gate by design.
api_router.include_router(seo.router, prefix="/seo", tags=["seo"])
