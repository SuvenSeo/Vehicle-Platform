from fastapi import APIRouter, Depends
from .endpoints import alerts, auth, chat, dealer, feedback, listings, market, pipeline, pro, stats
from .endpoints.auth import require_pro_access

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(listings.router, prefix="/listings", tags=["listings"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
# Pro endpoints become a real server-side boundary when PRO_ACCESS_ENFORCED=true.
api_router.include_router(pro.router, prefix="/pro", tags=["pro"], dependencies=[Depends(require_pro_access)])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(dealer.router, prefix="/dealer", tags=["dealer"])
