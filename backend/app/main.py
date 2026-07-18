import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import structlog
import os
from .api.v1.api import api_router
from db.session import init_db, hot_engine
from app.services.daily_sync_scheduler import start_daily_sync_scheduler, stop_daily_sync_scheduler

# Setup logging
structlog.configure(
    processors=[
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# Error tracking — no-op unless SENTRY_DSN is configured.
_sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
if _sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0") or 0),
        send_default_pii=False,
    )
    logger.info("sentry_initialized")

# Env-tunable: schema patches run bounded DDL (lock/statement timeouts), so
# worst-case init is patches + create_all across both engines. 20s proved too
# tight on HF Spaces cpu-basic against remote Postgres.
DB_INIT_TIMEOUT_SECONDS = int(os.getenv("DB_INIT_TIMEOUT_SECONDS", "60"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting_up")
    # In a real app, we'd use migrations (Alembic)
    # For now, we'll initialize the DB directly.
    # Runs in a thread with a hard timeout: init_db() is a blocking sync call,
    # and a stuck DB connection here would otherwise freeze the whole event
    # loop forever, so the app never starts accepting requests.
    try:
        await asyncio.wait_for(asyncio.to_thread(init_db), timeout=DB_INIT_TIMEOUT_SECONDS)
        logger.info("db_initialized")
    except asyncio.TimeoutError as e:
        logger.critical("db_init_timeout", timeout_seconds=DB_INIT_TIMEOUT_SECONDS)
        raise RuntimeError("Database initialization timed out. Aborting startup.") from e
    except Exception as e:
        logger.critical("db_init_failed", error=str(e))
        raise RuntimeError(f"Database initialization failed: {e}. Aborting startup.") from e

    try:
        start_daily_sync_scheduler()
    except Exception as e:
        logger.error("daily_sync_scheduler_start_failed", error=str(e))

    yield

    try:
        stop_daily_sync_scheduler()
    except Exception as e:
        logger.error("daily_sync_scheduler_stop_failed", error=str(e))


app = FastAPI(
    title="Motormila API",
    description="Car Market Intelligence Platform for Sri Lanka",
    version="1.0.0",
    lifespan=lifespan,
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

HEALTH_DB_PROBE_TIMEOUT_SECONDS = 5


def _probe_db() -> None:
    with hot_engine.connect() as conn:
        conn.execute(text("SELECT 1"))


from fastapi.responses import JSONResponse

@app.get("/health")
async def health_check():
    # A cheap bounded read probe: a Space with a dead database must not
    # keep reporting itself healthy to uptime monitoring.
    db_status = "ok"
    try:
        await asyncio.wait_for(asyncio.to_thread(_probe_db), timeout=HEALTH_DB_PROBE_TIMEOUT_SECONDS)
    except Exception as exc:
        db_status = "down"
        logger.warning("health_db_probe_failed", error=str(exc))

    content = {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "version": "1.0.0",
    }
    
    if db_status != "ok":
        return JSONResponse(status_code=503, content=content)
    return content

# Include API router
app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
