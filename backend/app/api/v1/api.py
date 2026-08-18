from fastapi import APIRouter, Depends
from .endpoints import admin, alerts, auth, b2b, billing, calculators, chat, dealer, events, feedback, listings, market, notifications, pipeline, pro, stats, vehicles
from .endpoints.auth import require_authenticated, require_pro_access

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
# Product data routes require a signed-in session when APP_ACCESS_ENFORCED=true.
_app_gate = [Depends(require_authenticated)]
api_router.include_router(listings.router, prefix="/listings", tags=["listings"], dependencies=_app_gate)
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"], dependencies=_app_gate)
api_router.include_router(stats.router, prefix="/stats", tags=["stats"], dependencies=_app_gate)
api_router.include_router(calculators.router, prefix="/calculators", tags=["calculators"], dependencies=_app_gate)
# Pro endpoints become a real server-side boundary when PRO_ACCESS_ENFORCED=true.
api_router.include_router(pro.router, prefix="/pro", tags=["pro"], dependencies=[Depends(require_pro_access)])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"], dependencies=_app_gate)
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"], dependencies=_app_gate)
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(market.router, prefix="/market", tags=["market"], dependencies=_app_gate)
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"], dependencies=_app_gate)
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"], dependencies=_app_gate)
api_router.include_router(dealer.router, prefix="/dealer", tags=["dealer"], dependencies=_app_gate)
api_router.include_router(b2b.router, prefix="/b2b", tags=["b2b"])
# Public write: rate-limited analytics events (funnel tracking, no auth required).
api_router.include_router(events.router, prefix="/events", tags=["events"])
