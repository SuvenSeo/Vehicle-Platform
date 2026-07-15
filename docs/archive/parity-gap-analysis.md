# Vehicle Platform Parity Gap Analysis

Date: 2026-04-18
Scope: Phase 4 parity review against the reference property platform roadmap.

## Executive Summary

The vehicle platform has moved from a basic scraper + dashboard implementation to a stronger production baseline. Recent work closed important trust and valuation gaps (alias-aware estimates, mileage calibration, confidence/verdict UX, source normalization, and automated Vercel deployment from main).

Remaining parity work is now concentrated in four system areas:

1. Data platform core hardening
2. Ingestion consistency and observability
3. Scheduler and operations control plane
4. Frontend operational parity and verification surface

## Gap Matrix

### 1) Data Platform Core

Current strengths:
- Normalized listing model and aggregate tables exist.
- Custom estimate endpoint now supports model aliasing and calibrated comparables.
- Stats and trend endpoints are operational.

Gaps to close:
- Aggregates currently include simplifications that reduce analytical confidence.
- Consistent percentile/median quality needs to be guaranteed from listing-level data.
- API-level parity contracts need explicit operational fields for downstream dashboards.

Target outcome:
- Deterministic aggregate computation with robust median/p25/p75 values.

### 2) Ingestion Pipeline

Current strengths:
- Primary and alternate sync runners support concurrent source execution.
- Source-level timeout guards and scrape run persistence exist.

Gaps to close:
- Source alias handling is not fully consistent across ingestion counting and monitoring.
- Ingestion telemetry should expose canonical source grouping and predictable run metadata.

Target outcome:
- Canonical source accounting across scraping, counts, and status APIs.

### 3) Scheduler and Operations

Current strengths:
- APScheduler script exists.
- Pipeline status endpoint exists and powers frontend status UI.

Gaps to close:
- No API-level trigger surface for controlled run execution.
- Limited run-history endpoint coverage for operations diagnostics.

Target outcome:
- Read/write operations API for status, recent runs, and controlled job triggering.

### 4) Frontend and Dashboard Parity

Current strengths:
- Dashboard includes pipeline status, district insights, trends, estimate workflow, and trust UX improvements.
- Frontend-to-backend contract for insights and custom estimate is stable.

Gaps to close:
- Missing operational controls and run-history visibility in dashboard workflows.
- End-to-end parity checks are not yet packaged into a repeatable verification flow.

Target outcome:
- Operations-aware dashboard parity with explicit status, recent runs, and trigger controls.

## Recommended Upgrade Path

Execute phases in this order:

1. Phase 6: Data platform core parity
2. Phase 7: Ingestion pipeline parity
3. Phase 8: Scheduler and operations parity
4. Phase 9: Frontend/dashboard parity and end-to-end verification

This sequence reduces rework by stabilizing backend data contracts before building new ops and UI surfaces on top.
