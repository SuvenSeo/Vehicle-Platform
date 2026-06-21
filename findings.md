# Findings

## Initial Repo Snapshot
- Property platform root includes `api`, `dashboard`, `db`, `scheduler`, `scraper`, `scripts`, `tests`, multiple runner utilities, and multiple deployment manifests.
- Vehicle platform root currently includes a Vite frontend (`src`, `public`) and a Python backend under `backend`, plus local runtime logs from previous runs.

## Early Comparison Signals
- The property platform appears to be organized as a fuller production system with ingestion, orchestration, deployment, and testing layers.
- The vehicle platform is likely missing parts of that operational surface area even if some frontend/backend flows exist.

## README and Manifest Comparison
- Property platform README is production-grade and documents features, stack, structure, local setup, pipeline flows, deployment, migrations, and API endpoints.
- Vehicle platform README now needs a final product-oriented rewrite to document architecture, runtime setup, and local workflows.
- Property frontend is in a separate `dashboard` app with a simpler, more explicit dependency graph.
- Vehicle frontend uses a heavier component stack and an embedded app/backend split, which increases the chance of partial integrations and dead imports.
- Vehicle backend dependency list includes scraping and scheduling dependencies, but those capabilities are not exposed at the same platform level as the property reference.

## Supabase Integration Context
- The user-provided Supabase snippet is for a Next.js app-router stack and uses `next/headers`, server components, and Next middleware patterns that do not apply to this Vite React frontend.
- The current vehicle repo already points the frontend at FastAPI through `VITE_API_URL`.
- The backend is already designed to connect to PostgreSQL/Supabase through `DATABASE_URL`, with SQLite only as a fallback when PostgreSQL is not configured.
- There is no existing frontend auth/session flow in the vehicle repo that would justify `@supabase/ssr` middleware patterns yet.

## Full Parity Decomposition
- `Data platform core`: schema, migrations, normalized models, backend layout, API contract consistency, and database configuration.
- `Ingestion pipeline`: source scrapers, processing, enrichment, aggregate generation, and deal-score logic.
- `Scheduler + operations`: APScheduler jobs, trigger/status endpoints, runner scripts, deployment manifests, and environment model.
- `Frontend parity`: dashboard completeness, pipeline visibility, trends/maps/detail flows, documentation, and production hardening.

## Phase 4 Gap Analysis Output (2026-04-18)
- Added a concrete parity gap document at `docs/parity-gap-analysis.md`.
- Confirmed the platform has strong progress on trust/readability UX and custom estimation quality, but still needs parity closure in data-core precision, ingestion canonicalization, operations control APIs, and dashboard ops controls.
- Locked recommended execution order: data core -> ingestion -> scheduler/ops -> frontend parity.

## Phase 5 Sequence Output (2026-04-18)
- Added `docs/parity-execution-sequence.md` with scope, deliverables, exit criteria, and commit checkpoints for phases 6-9.
- Confirmed autonomous execution path with verification and per-phase commit/push gates.

## Phase 6 Data-Core Output (2026-04-18)
- Upgraded `CarPriceAggregator.compute_aggregates()` to compute aggregate metrics from listing-level values instead of using average as a median proxy.
- Added deterministic percentile helper in aggregator service and now persist `avg`, `median`, `p25`, `p75`, and `listing_count` per aggregate key.
- Added `backend/tests/test_aggregator_percentiles.py` to verify percentile math and upsert behavior per period group.

## Phase 7 Ingestion Output (2026-04-18)
- Added shared source alias utility in `backend/app/services/source_aliases.py`.
- Updated `run_sync.py` and `run_alt_sync.py` to use canonical source tokens for listing counts.
- Updated scrape run creation to persist canonical source keys to improve downstream status consistency.
- Added `backend/tests/test_source_aliases.py` and verified ingestion guard behavior with full backend regression run.

## Phase 8 Scheduler + Ops Output (2026-04-18)
- Added `GET /api/v1/pipeline/runs` for recent run history.
- Added `POST /api/v1/pipeline/trigger` for controlled background sync triggering (`sync`, `alt_sync`).
- Added command builder and launcher helpers in pipeline endpoint module, with explicit validation and error mapping.
- Added `backend/tests/test_pipeline_ops.py` and re-ran full backend suite successfully.

## Phase 9 Frontend + Verification Output (2026-04-18)
- Added pipeline run-history and trigger API helpers in `src/services/api.ts` with new shared types in `src/types/car.ts`.
- Added `src/components/PipelineOperationsPanel.tsx` and integrated it into `src/pages/Dashboard.tsx` for ops control surface parity.
- Added frontend tests in `src/test/pipelineOpsApi.test.ts` and updated dashboard runtime mocks for new API exports.
- Verified frontend suite (`36 passed`) and production build (`vite build` success).

## Full UI/UX Audit + Redesign Pass (2026-05-06)

### Scope audited
- Global design tokens and typography system in `src/index.css`.
- Navigation readability and interaction consistency in `src/components/Navbar.tsx`.
- Listing-card information hierarchy and scannability in `src/components/ListingCard.tsx`.
- Filter rail legibility and control labeling in `src/components/FilterSidebar.tsx`.
- Loader, empty-state, and route-fail UX in `src/components/Loader.tsx` and `src/pages/NotFound.tsx`.
- Standalone route cohesion for `src/pages/EVHub.tsx`, `src/pages/Calculator.tsx`, and `src/pages/BestPicks.tsx`.

### High-impact issues found and addressed
- **Typography legibility debt**: repeated 9px/10px all-caps labels reduced readability and increased cognitive load.
	- Fixed by lifting baseline microcopy sizes (mostly 11px/12px), reducing excessive tracking, and aligning labels to one style family.
- **Visual hierarchy inconsistency**: cards/routes used different spacing and contrast patterns.
	- Fixed via shared surface language (`surface-card`, `section-shell`, `eyebrow-label`) and stronger, predictable section structure.
- **Scrollbar accessibility anti-pattern**: global scrollbar suppression made long flows less discoverable.
	- Fixed by removing full hide and preserving thin visible scrollbars.
- **Focus and contrast polish gaps**: some interactions lacked clear keyboard focus visibility at the global level.
	- Fixed by adding a consistent `:focus-visible` outline and high-contrast enhancement behavior.
- **Motion/readability balance**: some animated and loading areas over-prioritized style over clear status communication.
	- Fixed with improved loading text sizing and calmer animation-adjacent typography.

### Remaining medium-priority opportunities (next pass)
- Normalize microcopy and uppercase density across `src/pages/Dashboard.tsx`, `src/pages/Estimate.tsx`, and `src/pages/DealerDashboard.tsx`.
- Run an automated Lighthouse + axe pass and add measurable target budgets for contrast and interaction timings.
- Introduce page-level consistent content widths and vertical rhythm utilities in all high-traffic sections.
- Add explicit responsive QA for 320px and 400% zoom workflows (WCAG reflow checks).

### Verification
- Build passes with `npm run build`.
- Lint has **no errors**; existing repository warnings remain and are unrelated to this redesign scope.
