import asyncio
import os
from datetime import datetime, timezone

import structlog
from sqlalchemy import func, text
from sqlalchemy.exc import OperationalError

from app.scrapers.auto_lanka_site import AutoLankaSiteScraper
from app.scrapers.autodirect import AutoDirectScraper
from app.scrapers.autolanka import AutoLankaScraper
from app.scrapers.autostream import AutoStreamScraper
from app.scrapers.carshop import CarshopScraper
from app.scrapers.dimo import DimoScraper
from app.scrapers.ikman import IkmanCarScraper
from app.scrapers.patpat import PatpatScraper
from app.scrapers.riyahub import RiyahubScraper
from app.scrapers.riyasewana import RiyasewanaScraper
from app.scrapers.saleme import SaleMeScraper
from app.services.aggregator import CarPriceAggregator
from app.services.market_signals import MarketSignalImporter
from app.services.source_aliases import canonical_source_key, source_alias_tokens
from db.models import CarListing, ScrapeRun
from db.session import ColdSessionLocal as SessionLocal, init_db

log = structlog.get_logger()
MARKET_ANALYSIS_LOCK_KEY = 6182701

ALT_SOURCES = {
    "autolanka",
    "patpat",
    "auto-lanka",
    "autodirect",
    "autostream",
    "carshop",
    "saleme",
    "riyahub",
    "dimo",
}
SOURCE_PROFILES = {
    "all": (
        "ikman",
        "riyasewana",
        "autolanka",
        "patpat",
        "auto-lanka",
        "autodirect",
        "autostream",
        "carshop",
        "saleme",
        "riyahub",
        "dimo",
    ),
    "daily": ("ikman", "riyasewana", "carshop", "saleme", "riyahub", "dimo"),
    "alt": (
        "autolanka",
        "patpat",
        "auto-lanka",
        "autodirect",
        "autostream",
        "carshop",
        "saleme",
        "riyahub",
        "dimo",
    ),
}
SOURCE_REGISTRY = {
    "ikman": {
        "scraper": IkmanCarScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_IKMAN",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_IKMAN",
    },
    "riyasewana": {
        "scraper": RiyasewanaScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_RIYASEWANA",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_RIYASEWANA",
    },
    "autolanka": {
        "scraper": AutoLankaScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_AUTOLANKA",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_AUTOLANKA",
    },
    "patpat": {
        "scraper": PatpatScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_PATPAT",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_PATPAT",
    },
    "auto-lanka": {
        "scraper": AutoLankaSiteScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_AUTO_LANKA_SITE",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_AUTO_LANKA_SITE",
    },
    "autodirect": {
        "scraper": AutoDirectScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_AUTODIRECT",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_AUTODIRECT",
    },
    "autostream": {
        "scraper": AutoStreamScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_AUTOSTREAM",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_AUTOSTREAM",
    },
    "carshop": {
        "scraper": CarshopScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_CARSHOP",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_CARSHOP",
    },
    "saleme": {
        "scraper": SaleMeScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_SALEME",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_SALEME",
    },
    "riyahub": {
        "scraper": RiyahubScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_RIYAHUB",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_RIYAHUB",
    },
    "dimo": {
        "scraper": DimoScraper,
        "max_pages_env": "SCRAPE_MAX_PAGES_DIMO",
        "timeout_env": "SCRAPE_SOURCE_TIMEOUT_SECONDS_DIMO",
    },
}


def _resolve_positive_env_int(env_name: str, fallback: int) -> int:
    safe_fallback = max(1, int(fallback))
    raw_value = os.getenv(env_name)
    if raw_value is None or raw_value.strip() == "":
        return safe_fallback

    try:
        parsed = int(raw_value)
    except ValueError:
        log.warning(
            "scrape_setting_invalid",
            setting=env_name,
            value=raw_value,
            fallback=safe_fallback,
        )
        return safe_fallback

    if parsed <= 0:
        log.warning(
            "scrape_setting_non_positive",
            setting=env_name,
            value=parsed,
            fallback=safe_fallback,
        )
        return safe_fallback

    return parsed


def _resolve_bool_env(env_name: str, default: bool) -> bool:
    raw_value = os.getenv(env_name)
    if raw_value is None or raw_value.strip() == "":
        return default

    token = raw_value.strip().lower()
    if token in {"1", "true", "yes", "on"}:
        return True
    if token in {"0", "false", "no", "off"}:
        return False

    log.warning(
        "scrape_setting_invalid_bool",
        setting=env_name,
        value=raw_value,
        fallback=default,
    )
    return default


def _resolve_optional_timeout_env_int(
    env_name: str,
    fallback: int | None,
) -> int | None:
    raw_value = os.getenv(env_name)
    if raw_value is None or raw_value.strip() == "":
        return fallback

    try:
        parsed = int(raw_value)
    except ValueError:
        log.warning(
            "scrape_setting_invalid",
            setting=env_name,
            value=raw_value,
            fallback=fallback,
        )
        return fallback

    if parsed <= 0:
        log.info("scrape_timeout_disabled", setting=env_name, value=parsed)
        return None

    return parsed


def _resolve_enabled_sources(default_sources: tuple[str, ...]) -> set[str]:
    raw_value = os.getenv("SCRAPE_ENABLED_SOURCES")
    if raw_value is None or raw_value.strip() == "":
        return set(default_sources)

    requested = [
        token.strip().lower()
        for token in raw_value.split(",")
        if token and token.strip()
    ]
    allowed = set(default_sources)
    enabled: set[str] = set()

    for token in requested:
        # Prefer exact keys first so auto-lanka and autolanka remain distinct.
        if token in allowed:
            enabled.add(token)
            continue

        normalized = canonical_source_key(token) or token
        if normalized in allowed:
            enabled.add(normalized)
        else:
            log.warning("scrape_source_unknown", source=token)

    return enabled


def _resolve_profile(profile_override: str | None = None) -> str:
    token = (profile_override or os.getenv("SCRAPE_PROFILE") or "all").strip().lower()
    if token in SOURCE_PROFILES:
        return token

    log.warning(
        "scrape_profile_unknown",
        profile=token,
        fallback="all",
        allowed=sorted(SOURCE_PROFILES.keys()),
    )
    return "all"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _close_db_session(db, *, context: str, source: str | None = None):
    try:
        db.close()
    except Exception as exc:
        log.warning(
            "db_session_close_failed",
            context=context,
            source=source,
            error=str(exc),
        )


def _count_source_listings(db, source_name: str) -> int:
    aliases = sorted(source_alias_tokens(source_name))
    source_expr = func.lower(
        func.replace(
            func.replace(
                func.replace(
                    func.replace(func.coalesce(CarListing.source, ""), "-", ""),
                    "_",
                    "",
                ),
                ".",
                "",
            ),
            " ",
            "",
        )
    )

    return int(
        db.query(func.count(CarListing.id))
        .filter(source_expr.in_(aliases), CarListing.is_outlier == False)
        .scalar()
        or 0
    )


def _count_source_listings_safe(source_name: str) -> int:
    db = SessionLocal()
    try:
        return _count_source_listings(db, source_name)
    except Exception as exc:
        db.rollback()
        log.warning("source_listing_count_failed", source=source_name, error=str(exc))
        return 0
    finally:
        _close_db_session(db, context="count_source_listings", source=source_name)


def _start_scrape_run(db, source_name: str) -> ScrapeRun:
    canonical_source = canonical_source_key(source_name) or source_name
    run = ScrapeRun(
        source=canonical_source,
        started_at=_utcnow(),
        status="RUNNING",
        listings_found=0,
        listings_new=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _finalize_scrape_run(
    db,
    run: ScrapeRun,
    *,
    status: str,
    listings_found: int,
    listings_new: int,
    error_message: str | None = None,
):
    run.status = status
    run.finished_at = _utcnow()
    run.listings_found = max(0, int(listings_found))
    run.listings_new = max(0, int(listings_new))
    run.error_message = (error_message or "").strip()[:2000] or None
    db.commit()


def _finalize_scrape_run_safe(
    run_id: int | None,
    *,
    status: str,
    listings_found: int,
    listings_new: int,
    error_message: str | None = None,
):
    if run_id is None:
        return

    db = SessionLocal()
    try:
        run = db.query(ScrapeRun).filter(ScrapeRun.id == run_id).first()
        if run is None:
            return
        _finalize_scrape_run(
            db,
            run,
            status=status,
            listings_found=listings_found,
            listings_new=listings_new,
            error_message=error_message,
        )
    except Exception as exc:
        db.rollback()
        log.error("scrape_run_finalize_failed", run_id=run_id, error=str(exc))
    finally:
        _close_db_session(db, context="finalize_scrape_run")


def _is_statement_timeout_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "statement timeout" in message or "querycanceled" in message


def _is_postgresql_session(db) -> bool:
    try:
        bind = db.get_bind()
    except Exception:
        return False
    return bool(bind is not None and bind.dialect.name == "postgresql")


def _try_acquire_market_analysis_lock(db) -> bool:
    if not _is_postgresql_session(db):
        return True
    return bool(
        db.execute(
            text("SELECT pg_try_advisory_lock(:lock_key)"),
            {"lock_key": MARKET_ANALYSIS_LOCK_KEY},
        ).scalar()
    )


def _release_market_analysis_lock(db):
    if not _is_postgresql_session(db):
        return
    db.execute(
        text("SELECT pg_advisory_unlock(:lock_key)"),
        {"lock_key": MARKET_ANALYSIS_LOCK_KEY},
    )


async def _run_source(scraper_cls, max_pages: int, source_timeout_seconds: int | None):
    source_name = scraper_cls.SOURCE
    if max_pages <= 0:
        log.info(
            "scraping_source_skipped",
            source=source_name,
            max_pages=max_pages,
            reason="max_pages_not_positive",
        )
        return

    db = SessionLocal()
    run_id = None
    listings_before = 0
    try:
        listings_before = _count_source_listings_safe(source_name)
        try:
            run = _start_scrape_run(db, source_name)
            run_id = run.id
        except Exception as run_exc:
            db.rollback()
            log.error("scrape_run_start_failed", source=source_name, error=str(run_exc))

        log.info("scraping_source_started", source=source_name, max_pages=max_pages)
        scraper = scraper_cls(db)
        if source_timeout_seconds is None:
            await scraper.scrape(max_pages=max_pages)
        else:
            await asyncio.wait_for(
                scraper.scrape(max_pages=max_pages),
                timeout=source_timeout_seconds,
            )
        listings_after = _count_source_listings_safe(source_name)
        _finalize_scrape_run_safe(
            run_id,
            status="SUCCESS",
            listings_found=listings_after,
            listings_new=max(0, listings_after - listings_before),
        )
        log.info("scraping_source_completed", source=source_name)
    except asyncio.TimeoutError:
        listings_after = _count_source_listings_safe(source_name)
        _finalize_scrape_run_safe(
            run_id,
            status="FAILED",
            listings_found=listings_after,
            listings_new=max(0, listings_after - listings_before),
            error_message=f"Source timed out after {source_timeout_seconds}s",
        )
        log.error(
            "scraping_source_timeout",
            source=source_name,
            timeout_seconds=source_timeout_seconds,
        )
    except Exception as exc:
        listings_after = _count_source_listings_safe(source_name)
        _finalize_scrape_run_safe(
            run_id,
            status="FAILED",
            listings_found=listings_after,
            listings_new=max(0, listings_after - listings_before),
            error_message=str(exc),
        )
        log.error("scraping_source_failed", source=source_name, error=str(exc))
    finally:
        _close_db_session(db, context="run_source", source=source_name)


def _build_source_configs(profile: str) -> list[tuple[str, type, int, int | None]]:
    default_max_pages = _resolve_positive_env_int("SCRAPE_MAX_PAGES", 5)
    alt_default_max_pages = _resolve_positive_env_int(
        "SCRAPE_MAX_PAGES_ALT",
        default_max_pages,
    )
    default_timeout_seconds = _resolve_optional_timeout_env_int(
        "SCRAPE_SOURCE_TIMEOUT_SECONDS",
        1800,
    )
    alt_timeout_seconds = _resolve_optional_timeout_env_int(
        "SCRAPE_SOURCE_TIMEOUT_SECONDS_ALT",
        default_timeout_seconds,
    )

    configs: list[tuple[str, type, int, int | None]] = []
    for source_key in SOURCE_PROFILES[profile]:
        settings = SOURCE_REGISTRY[source_key]
        max_pages_fallback = alt_default_max_pages if source_key in ALT_SOURCES else default_max_pages
        max_pages = _resolve_positive_env_int(settings["max_pages_env"], max_pages_fallback)
        timeout_fallback = alt_timeout_seconds if source_key in ALT_SOURCES else default_timeout_seconds
        timeout_seconds = _resolve_optional_timeout_env_int(settings["timeout_env"], timeout_fallback)
        configs.append((source_key, settings["scraper"], max_pages, timeout_seconds))
    return configs


async def main(profile_override: str | None = None):
    log.info("ensuring_db_schema")
    try:
        init_db()
        log.info("db_schema_ready")
    except Exception as exc:
        log.error("db_schema_init_failed", error=str(exc))
        raise

    start_time = datetime.now()
    profile = _resolve_profile(profile_override)
    source_configs = _build_source_configs(profile)
    enabled_sources = _resolve_enabled_sources(SOURCE_PROFILES[profile])
    active_configs = [config for config in source_configs if config[0] in enabled_sources]
    run_scrapers = _resolve_bool_env("RUN_SCRAPERS", True)
    run_market_analysis = _resolve_bool_env("RUN_MARKET_ANALYSIS", True)
    run_market_signals = _resolve_bool_env("RUN_MARKET_SIGNALS", run_market_analysis)

    log.info(
        "starting_sync",
        profile=profile,
        start_time=start_time.isoformat(),
        enabled_sources=sorted(enabled_sources),
        run_scrapers=run_scrapers,
        run_market_analysis=run_market_analysis,
        run_market_signals=run_market_signals,
        source_max_pages={source: pages for source, _cls, pages, _timeout in source_configs},
        source_timeouts={
            source: timeout_seconds
            for source, _cls, _pages, timeout_seconds in source_configs
        },
    )

    try:
        if not run_scrapers:
            log.info("scraping_skipped", reason="run_scrapers_disabled", profile=profile)
        elif not active_configs:
            log.warning("scraping_skipped", reason="no_enabled_sources", profile=profile)
        else:
            # Run sources independently, one-by-one, so one source failure never blocks the rest.
            for _source, scraper_cls, max_pages, timeout_seconds in active_configs:
                await _run_source(scraper_cls, max_pages, timeout_seconds)

        if run_market_analysis:
            db = SessionLocal()
            lock_acquired = False
            try:
                log.info("running_market_analysis")
                lock_acquired = _try_acquire_market_analysis_lock(db)
                if not lock_acquired:
                    log.warning("market_analysis_skipped", reason="lock_not_acquired")
                else:
                    if run_market_signals:
                        signal_result = MarketSignalImporter(db).sync()
                        log.info("market_signals_synced", **signal_result)
                    aggregator = CarPriceAggregator(db)
                    current = datetime.now()
                    aggregator.compute_aggregates(current.year, current.month)
                    aggregator.update_deal_scores()
            except OperationalError as exc:
                db.rollback()
                if _is_statement_timeout_error(exc):
                    log.warning("market_analysis_skipped", reason="statement_timeout", error=str(exc))
                else:
                    raise
            finally:
                if lock_acquired:
                    _release_market_analysis_lock(db)
                _close_db_session(db, context="market_analysis")
        else:
            log.info("market_analysis_skipped", reason="run_market_analysis_disabled")

        duration = (datetime.now() - start_time).total_seconds()
        log.info("sync_completed", profile=profile, duration_seconds=round(duration, 2))
    except Exception as exc:
        log.error("sync_failed", profile=profile, error=str(exc))
        raise


if __name__ == "__main__":
    asyncio.run(main())
