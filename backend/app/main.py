from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog
import os
from .api.v1.api import api_router
from db.session import init_db
from app.services.daily_sync_scheduler import start_daily_sync_scheduler, stop_daily_sync_scheduler

# Setup logging
structlog.configure(
    processors=[
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

app = FastAPI(
    title="AutoLens LK API",
    description="Car Market Intelligence Platform for Sri Lanka",
    version="1.0.0"
)

cors_origins = os.getenv("CORS_ORIGINS")
if cors_origins:
    allow_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
else:
    allow_origins = [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://vehicle-platform-one.vercel.app",
        "https://vehicle-platform-one-suvenseoras-projects.vercel.app",
    ]

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    logger.info("starting_up")
    # In a real app, we'd use migrations (Alembic)
    # For now, we'll initialize the DB directly
    try:
        init_db()
        logger.info("db_initialized")
    except Exception as e:
        logger.error("db_init_failed", error=str(e))

    try:
        start_daily_sync_scheduler()
    except Exception as e:
        logger.error("daily_sync_scheduler_start_failed", error=str(e))


@app.on_event("shutdown")
async def on_shutdown():
    try:
        stop_daily_sync_scheduler()
    except Exception as e:
        logger.error("daily_sync_scheduler_stop_failed", error=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

# Include API router
app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
