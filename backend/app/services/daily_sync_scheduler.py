import asyncio
import os
from typing import Optional
from zoneinfo import ZoneInfo

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import run_sync

log = structlog.get_logger()

_scheduler: Optional[AsyncIOScheduler] = None
_sync_lock = asyncio.Lock()


def _env_truthy(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    token = raw.strip().lower()
    if token in {"1", "true", "yes", "on"}:
        return True
    if token in {"0", "false", "no", "off"}:
        return False
    return default


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        parsed = int(raw)
    except ValueError:
        log.warning("daily_sync_env_invalid", setting=name, value=raw, fallback=default)
        return default

    if parsed < minimum or parsed > maximum:
        log.warning(
            "daily_sync_env_out_of_range",
            setting=name,
            value=parsed,
            minimum=minimum,
            maximum=maximum,
            fallback=default,
        )
        return default

    return parsed


def _resolve_sync_hours() -> list[int]:
    """Return sorted list of hours at which the sync should run.

    Reads DAILY_SYNC_HOURS (comma-separated integers 0-23).
    Falls back to DAILY_SYNC_HOUR for single-hour backward compat.
    Defaults to [6, 18] (twice a day).
    """
    raw = os.getenv("DAILY_SYNC_HOURS") or ""
    if raw.strip():
        hours: list[int] = []
        for token in raw.split(","):
            token = token.strip()
            if not token:
                continue
            try:
                h = int(token)
            except ValueError:
                log.warning("daily_sync_hours_invalid_token", token=token)
                continue
            if 0 <= h <= 23:
                hours.append(h)
            else:
                log.warning("daily_sync_hours_out_of_range", hour=h)
        if hours:
            return sorted(set(hours))
        log.warning("daily_sync_hours_all_invalid", fallback=[6, 18])
        return [6, 18]

    # Backward-compat: honour the old single DAILY_SYNC_HOUR if set.
    single = os.getenv("DAILY_SYNC_HOUR")
    if single is not None and single.strip():
        try:
            h = int(single.strip())
            if 0 <= h <= 23:
                return [h]
        except ValueError:
            pass

    return [6, 18]


def _resolve_timezone() -> ZoneInfo:
    zone_name = (os.getenv("DAILY_SYNC_TIMEZONE") or "Asia/Colombo").strip() or "Asia/Colombo"
    try:
        return ZoneInfo(zone_name)
    except Exception:
        log.warning("daily_sync_timezone_invalid", timezone=zone_name, fallback="UTC")
        return ZoneInfo("UTC")


async def _run_daily_sync_job() -> None:
    profile = (os.getenv("DAILY_SYNC_PROFILE") or "daily").strip().lower() or "daily"
    timeout_seconds = _env_int("DAILY_SYNC_TIMEOUT_SECONDS", default=5400, minimum=120, maximum=14400)

    if _sync_lock.locked():
        log.warning("daily_sync_skipped", reason="already_running", profile=profile)
        return

    async with _sync_lock:
        log.info("daily_sync_started", profile=profile, timeout_seconds=timeout_seconds)
        try:
            await asyncio.wait_for(run_sync.main(profile_override=profile), timeout=float(timeout_seconds))
            log.info("daily_sync_completed", profile=profile)
        except asyncio.TimeoutError:
            log.error("daily_sync_timeout", profile=profile, timeout_seconds=timeout_seconds)
        except Exception as exc:
            log.error("daily_sync_failed", profile=profile, error=str(exc))


def start_daily_sync_scheduler() -> None:
    global _scheduler

    if not _env_truthy("DAILY_SYNC_ENABLED", True):
        log.info("daily_sync_disabled")
        return

    if _scheduler is not None and _scheduler.running:
        return

    hours = _resolve_sync_hours()
    minute = _env_int("DAILY_SYNC_MINUTE", default=10, minimum=0, maximum=59)
    timezone = _resolve_timezone()

    scheduler = AsyncIOScheduler(timezone=timezone)
    for hour in hours:
        job_id = f"daily-listing-sync-{hour:02d}h"
        scheduler.add_job(
            _run_daily_sync_job,
            trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id=job_id,
            max_instances=1,
            coalesce=True,
            replace_existing=True,
            misfire_grace_time=3600,
        )
    scheduler.start()

    _scheduler = scheduler

    next_runs = {}
    for hour in hours:
        job_id = f"daily-listing-sync-{hour:02d}h"
        job = scheduler.get_job(job_id)
        if job is not None and job.next_run_time is not None:
            next_runs[job_id] = job.next_run_time.isoformat()

    log.info(
        "daily_sync_scheduler_started",
        timezone=str(timezone),
        hours=hours,
        minute=minute,
        next_runs=next_runs,
    )

    # Defaults to False: firing a live scrape immediately on every cold boot
    # (including on every redeploy) risks starving the event loop before the
    # API has ever become reachable. The cron schedule above still covers
    # regular syncs; set DAILY_SYNC_RUN_ON_STARTUP=true to opt back in.
    if _env_truthy("DAILY_SYNC_RUN_ON_STARTUP", False):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_run_daily_sync_job())
        except RuntimeError:
            log.warning("daily_sync_startup_run_skipped", reason="no_running_event_loop")


def stop_daily_sync_scheduler() -> None:
    global _scheduler

    if _scheduler is None:
        return

    try:
        _scheduler.shutdown(wait=False)
        log.info("daily_sync_scheduler_stopped")
    except Exception as exc:
        log.warning("daily_sync_scheduler_stop_failed", error=str(exc))
    finally:
        _scheduler = None
