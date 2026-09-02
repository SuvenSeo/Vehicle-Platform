#!/usr/bin/env python3
"""Check Neon data-transfer (egress) usage against the monthly budget.

Used by .github/workflows/neon-egress-watch.yml so the team gets an early
warning BEFORE the free-tier transfer allowance is exhausted (which blocks all
DB connections — the exact incident that paused scrapers before).

Sources, in order of preference:
  1. Neon Admin API  — GET /api/v2/projects/{project_id}/usage  (and org variant)
                       Requires NEON_API_KEY + NEON_PROJECT_ID (optionally
                       NEON_ORG_ID). Best-effort parsing of the metrics array.
  2. DB estimate      — connects to the configured database and estimates the
                       monthly read volume from table size (pg_total_relation_size)
                       plus a documented full-table-read cadence (snapshot
                       exports + pg_dump backups). No API key needed.

Exit codes:
  0 = under budget (ok)
  1 = OVER budget  (fail — triggers Slack alert / workflow failure)
  2 = warning threshold crossed (>= 80% of budget)
  3 = check could not run (missing env, API error, no DB) — non-fatal

Environment:
  NEON_API_KEY, NEON_PROJECT_ID        — optional; enables live API check
  NEON_ORG_ID                          — optional fallback for org-level usage
  NEON_TRANSFER_BUDGET_GB              — monthly budget; default 5 (Launch/free)
  NEON_WARN_FRACTION                   — warning threshold; default 0.8
  HOT_DATABASE_URL / COLD_DATABASE_URL / DATABASE_URL — for the DB estimate
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

BUDGET_GB_DEFAULT = 5.0
WARN_FRACTION_DEFAULT = 0.70

# Documented full-table reads that move the whole car_listings table out of Neon
# each month. Kept as a conservative estimate when the API is unavailable.
FULL_READS_PER_MONTH = {
    "listing_catalog_full_exports": 10,  # full catalog refresh every 3 days (10x/month)
    "pg_dump_weekly": 4,                 # 1 weekly full compressed backup
    "scrape_export_redeploy": 1,         # occasional manual full refresh
}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "") or default)
    except (TypeError, ValueError):
        return default


def _emit_outputs(values: dict[str, str]) -> None:
    """Write key=value lines to $GITHUB_OUTPUT when running inside Actions.

    Plain stdout lines are NOT captured as step outputs by GitHub Actions —
    only lines appended to the GITHUB_OUTPUT file are. Emit both so the
    workflow can read steps.egress.outputs.* reliably.
    """
    github_output = os.getenv("GITHUB_OUTPUT", "").strip()
    if not github_output:
        return
    try:
        with open(github_output, "a", encoding="utf-8") as handle:
            for key, value in values.items():
                handle.write(f"{key}={value}\n")
    except OSError as exc:
        print(f"[warn] could not write GITHUB_OUTPUT: {exc}")


def _fetch_json(url: str, api_key: str, timeout: int = 20) -> dict | None:
    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "User-Agent": "motormila-egress-check/1.0",
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[api] request failed for {url}: {exc}")
        return None


def _extract_data_transfer_gb(payload: dict | None) -> float | None:
    """Parse Neon usage API responses (project or org level)."""
    if not isinstance(payload, dict):
        return None
    # Project object responses nest the metrics under {"project": {...}}.
    if isinstance(payload.get("project"), dict):
        payload = payload["project"]
    # Common shapes: {"usage": [...]} or {"consumption": [...]} or direct list.
    usage_rows = payload.get("usage") or payload.get("consumption")
    if not isinstance(usage_rows, list):
        usage_rows = [payload]
    for row in usage_rows:
        if not isinstance(row, dict):
            continue
        metrics = row.get("metrics")
        if isinstance(metrics, list):
            for metric in metrics:
                if not isinstance(metric, dict):
                    continue
                name = str(metric.get("metric") or metric.get("name") or "").lower()
                if "data" in name and ("transfer" in name or "egress" in name):
                    amount = metric.get("amount") or metric.get("value")
                    if amount is not None:
                        try:
                            return float(amount)
                        except (TypeError, ValueError):
                            pass
        # Some shapes put data_transfer directly on the row.
        direct = row.get("data_transfer") or row.get("egress_gb") or row.get("dataTransfer")
        if direct is not None:
            try:
                return float(direct)
            except (TypeError, ValueError):
                pass
        # Project object shape: data_transfer_bytes (bytes) → GB
        bytes_val = row.get("data_transfer_bytes") or row.get("dataTransferBytes")
        if bytes_val is not None:
            try:
                return float(bytes_val) / (1024 ** 3)
            except (TypeError, ValueError):
                pass
    return None


def check_via_api() -> tuple[float | None, str]:
    api_key = os.getenv("NEON_API_KEY", "").strip()
    project_id = os.getenv("NEON_PROJECT_ID", "").strip()
    org_id = os.getenv("NEON_ORG_ID", "").strip()
    if not api_key or not project_id:
        return None, "NEON_API_KEY / NEON_PROJECT_ID not set — skipped"

    # Current API versions return usage inline on the project object
    # (data_transfer_bytes); older /usage routes are tried as fallbacks.
    candidates = [
        f"https://console.neon.tech/api/v2/projects/{project_id}",
        f"https://console.neon.tech/api/v2/projects/{project_id}/usage",
    ]
    if org_id:
        candidates.append(f"https://console.neon.tech/api/v2/organizations/{org_id}/usage")

    for url in candidates:
        payload = _fetch_json(url, api_key)
        used_gb = _extract_data_transfer_gb(payload)
        if used_gb is not None:
            return used_gb, f"Neon API ({url})"

    return None, f"Neon API queried but no data-transfer metric found ({len(candidates)} endpoint(s))"


def check_via_db_estimate() -> tuple[float | None, str]:
    """Estimate monthly transfer from car_listings size and documented cadence."""
    db_url = (
        os.getenv("HOT_DATABASE_URL", "").strip()
        or os.getenv("COLD_DATABASE_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    if not db_url:
        return None, "no database URL configured for estimate"

    # Only a real Postgres URL can estimate (pg_total_relation_size is PG-only;
    # sqlite has no table bytes equivalent and never burns Neon egress anyway).
    if db_url.startswith("sqlite") or "postgres" not in db_url.split("://", 1)[0]:
        return None, "DB estimate requires a Postgres URL"

    table_bytes = 0.0
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 8, "sslmode": "require"},
        )
        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT pg_total_relation_size('car_listings') "
                    "AS bytes, count(*) AS rows FROM car_listings"
                )
            ).first()
            table_bytes = float(row.bytes or 0)
        engine.dispose()
    except Exception as exc:
        print(f"[db] estimate failed: {exc}")
        return None, "DB estimate failed"

    table_mb = table_bytes / (1024 * 1024)
    total_reads = sum(FULL_READS_PER_MONTH.values())
    estimated_gb = (table_mb * total_reads) / 1024.0
    detail = (
        f"car_listings ~ {table_mb:.1f} MB; "
        f"{total_reads} full reads/mo => ~ {estimated_gb:.2f} GB/mo egress"
    )
    return estimated_gb, f"DB size estimate ({detail})"


def main() -> int:
    budget_gb = _env_float("NEON_TRANSFER_BUDGET_GB", BUDGET_GB_DEFAULT)
    warn_fraction = _env_float("NEON_WARN_FRACTION", WARN_FRACTION_DEFAULT)

    used_gb, source = check_via_api()
    if used_gb is None:
        used_gb, source = check_via_db_estimate()

    status = "unknown"
    if used_gb is None:
        status = "unknown"
    else:
        fraction = used_gb / budget_gb if budget_gb > 0 else 1.0
        if used_gb > budget_gb:
            status = "over"
        elif fraction >= warn_fraction:
            status = "warning"
        else:
            status = "ok"

    outputs = {
        "neon_egress_used_gb": "" if used_gb is None else f"{used_gb:.3f}",
        "neon_egress_budget_gb": f"{budget_gb:.3f}",
        "neon_egress_source": source.replace("\n", " "),
        "neon_egress_fraction": "" if used_gb is None else f"{fraction:.3f}",
        "neon_egress_status": status,
    }
    for key, value in outputs.items():
        print(f"{key}={value}")
    _emit_outputs(outputs)

    if status == "over":
        print(
            f"::error::Neon data transfer OVER budget: {used_gb:.2f} GB "
            f"/ {budget_gb:.2f} GB ({source}). Consider upgrading or trimming "
            "full-catalog exports (docs/neon-egress-budget.md)."
        )
        return 1
    if status == "warning":
        print(
            f"::warning::Neon data transfer at {fraction * 100:.0f}% of budget "
            f"({used_gb:.2f} / {budget_gb:.2f} GB, {source})."
        )
        return 2
    if status == "unknown":
        print("Neon usage could not be determined (see source above).")
        return 3

    print(f"Neon data transfer OK: {used_gb:.2f} GB / {budget_gb:.2f} GB ({source}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
