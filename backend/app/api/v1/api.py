from fastapi import APIRouter
from .endpoints import chat, feedback, listings, market, pipeline, pro, stats

api_router = APIRouter()
api_router.include_router(listings.router, prefix="/listings", tags=["listings"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(pro.router, prefix="/pro", tags=["pro"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
