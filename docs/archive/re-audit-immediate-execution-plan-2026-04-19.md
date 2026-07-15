# AutoLens LK Immediate Re-Audit Execution Plan (2026-04-19)

## Scope Lock

- Currency display standard: LKR millions using M suffix (example: Rs. 7.25M).
- Main execution phases below exclude scraper-module edits.
- Scraper-related improvements are split into a deferred workstream at the end.
- After each completed phase: commit and push to main.

## Phase Order and Dependency Graph

1. Phase 1: Price integrity guardrails (foundation)
2. Phase 2: Valuation comparable relevance (depends on Phase 1)
3. Phase 3: Missing-field semantics and trust UX (depends on Phase 1)
4. Phase 4: Currency consistency in M units (depends on Phase 1)
5. Phase 5: UI polish for audit issues (depends on Phases 3 and 4)
6. Phase 6: Full verification and release gate (depends on Phases 1-5)

---

## Phase 1 - Price Integrity Guardrails

### Objective
Prevent zero or missing prices from being silently converted into valid values and surfacing as fake best deals.

### Files
- backend/app/api/v1/endpoints/stats.py
- src/services/api.ts
- src/pages/Dashboard.tsx
- src/test/dashboardInsightsApi.test.ts
- src/test/dashboardRuntime.test.tsx

### Changes
- Backend insights:
  - In hot deal query payload assembly, ensure only strictly positive prices are eligible.
  - Keep API payload numeric/null truthful instead of introducing synthetic zeros.
- Frontend API normalization:
  - Remove default coercion patterns that force price_lkr to 0 for insight rows and hot deals.
  - Keep nullable fields nullable where the source value is absent.
- Dashboard spotlight:
  - Best Live Deal selection should only consider entries with price_lkr > 0.
  - If no valid priced deal exists, render fallback copy instead of showing Rs. 0.00M.

### Verification
- Frontend targeted:
  - npm run test -- src/test/dashboardInsightsApi.test.ts src/test/dashboardRuntime.test.tsx
- Backend targeted:
  - pytest backend/tests/test_aggregator_percentiles.py -q

### Commit and Push
- git add backend/app/api/v1/endpoints/stats.py src/services/api.ts src/pages/Dashboard.tsx src/test/dashboardInsightsApi.test.ts src/test/dashboardRuntime.test.tsx
- git commit -m "phase-1: add positive-price guardrails for insights and spotlight deal"
- git push origin main

---

## Phase 2 - Valuation Comparable Relevance

### Objective
Prioritize exact model and aliases while preventing unrelated models from appearing as top comparables.

### Files
- backend/app/api/v1/endpoints/listings.py
- backend/tests/test_model_aliases.py
- backend/tests/test_custom_estimate_calibration.py

### Changes
- Tighten matching pipeline in custom estimate selection:
  - Keep exact model rank highest, alias rank next, unrelated rank rejected for high-quality set.
  - Keep fallback behavior for low-volume markets, but never let irrelevant models dominate top comparables.
- Ensure strategy transitions preserve confidence and methodology transparency.

### Verification
- pytest backend/tests/test_model_aliases.py backend/tests/test_custom_estimate_calibration.py -q

### Commit and Push
- git add backend/app/api/v1/endpoints/listings.py backend/tests/test_model_aliases.py backend/tests/test_custom_estimate_calibration.py
- git commit -m "phase-2: improve comparable ranking and model relevance"
- git push origin main

---

## Phase 3 - Missing-Field Semantics and Trust UX (Non-Scraper)

### Objective
Present missing data explicitly and consistently without pretending unknown values are real values.

### Files
- backend/app/models/schemas.py
- src/services/api.ts
- src/components/ListingCard.tsx
- src/components/PriceUnavailableBadge.tsx
- src/test/priceUnavailableBadge.test.tsx

### Changes
- Preserve null semantics across backend response model and frontend mapping.
- Ensure UI copy uses explicit unavailable wording for price and technical fields.
- Keep listing cards consistent when mileage/fuel/transmission/body type are missing.

### Verification
- npm run test -- src/test/priceUnavailableBadge.test.tsx src/test/listingCardRender.test.tsx

### Commit and Push
- git add backend/app/models/schemas.py src/services/api.ts src/components/ListingCard.tsx src/components/PriceUnavailableBadge.tsx src/test/priceUnavailableBadge.test.tsx
- git commit -m "phase-3: standardize missing-field semantics and trust labels"
- git push origin main

---

## Phase 4 - Currency Consistency in LKR Millions (M)

### Objective
Unify all user-facing price displays and chart units to LKR millions (M).

### Files
- src/lib/formatting.ts
- src/services/api.ts
- src/pages/Dashboard.tsx
- src/pages/Trends.tsx
- src/components/DistrictHeatmap.tsx
- src/test/formatting.test.ts

### Changes
- Replace Lakhs naming with millions naming in formatter symbols and imports.
  - Example target naming: formatPriceLkrMillions.
- Ensure all y-axis tick formatters in Dashboard and Trends use M units.
- Keep one canonical formatter path used by cards, tooltips, heatmap popups, and insights tiles.
- Update tests to assert M output and canonical function naming.

### Verification
- npm run test -- src/test/formatting.test.ts src/test/dashboardRuntime.test.tsx
- npm run build

### Commit and Push
- git add src/lib/formatting.ts src/services/api.ts src/pages/Dashboard.tsx src/pages/Trends.tsx src/components/DistrictHeatmap.tsx src/test/formatting.test.ts
- git commit -m "phase-4: standardize all pricing to LKR millions (M)"
- git push origin main

---

## Phase 5 - Targeted UI Polish

### Objective
Resolve remaining high-friction UX issues from the audit while preserving current architecture.

### Files
- src/components/PriceUnavailableBadge.tsx
- src/components/Navbar.tsx
- src/components/DistrictHeatmap.tsx
- src/components/ListingCard.tsx
- src/test/navbarAccessibility.test.tsx

### Changes
- Increase PriceUnavailable badge contrast and readability in dark surfaces.
- Strengthen Navbar active-state visibility on both desktop and mobile.
- Reduce district label overlap in heatmap:
  - show fewer permanent labels at low zoom or use selection/hover-first labeling.
- Tighten mobile density in listing cards and key dashboard blocks (spacing and text rhythm only).

### Verification
- npm run test -- src/test/navbarAccessibility.test.tsx src/test/priceUnavailableBadge.test.tsx src/test/listingCardRender.test.tsx
- npm run build

### Commit and Push
- git add src/components/PriceUnavailableBadge.tsx src/components/Navbar.tsx src/components/DistrictHeatmap.tsx src/components/ListingCard.tsx src/test/navbarAccessibility.test.tsx
- git commit -m "phase-5: polish badge contrast nav visibility and heatmap readability"
- git push origin main

---

## Phase 6 - Release Verification Gate

### Objective
Run end-to-end verification before release confirmation.

### Commands
- Backend full suite:
  - pytest backend/tests -q
- Frontend full suite:
  - npm run test
- Frontend lint/build:
  - npm run lint
  - npm run build

### Manual acceptance checks
- Best Live Deal never renders Rs. 0.00M.
- Top comparables for model-specific estimate are relevant.
- Missing prices and attributes are shown as unavailable, not as fake values.
- All displayed price units are LKR millions (M), including chart ticks.
- Navbar active state is clearly visible.
- District heatmap labels remain readable without heavy overlap.

### Commit and Push
- git add .
- git commit -m "phase-6: run full verification gate for re-audit fixes"
- git push origin main

---

## Deferred Workstream - Scraper-Related Changes (Do Not Execute in Main Phases)

This section is intentionally separated per request.

### Scraper files to target later
- backend/app/scrapers/cleaner.py
- backend/app/scrapers/autolanka.py
- backend/app/scrapers/auto_lanka_site.py
- backend/app/scrapers/autodirect.py
- backend/app/scrapers/ikman.py
- backend/app/scrapers/patpat.py
- backend/app/scrapers/riyasewana.py
- backend/tests/test_cleaner.py
- backend/tests/test_scraper_runtime_guards.py

### What to ask Copilot CLI to do
- Add extraction heuristics for fuel_type, transmission, body_type, and condition from title/spec text blocks when structured fields are absent.
- Keep strict price parsing and rejection of installment-only/noise values.
- Preserve normalize_listing_payload rejection for invalid critical fields.
- Add test fixtures covering mixed-format metadata from each source.
- Verify no regression in existing cleaner and runtime guard tests.

### Suggested Copilot CLI prompt
Implement scraper-only improvements for technical field completeness without touching API or frontend files. Scope strictly to backend/app/scrapers/*.py and scraper-related tests. Add robust extraction fallbacks for fuel_type, transmission, body_type, condition from title/details/spec blobs, retain strict price validity filters, and expand tests in backend/tests/test_cleaner.py and backend/tests/test_scraper_runtime_guards.py. Run pytest backend/tests/test_cleaner.py backend/tests/test_scraper_runtime_guards.py -q, then provide a commit with changed files summary.

### Commit and Push for deferred scraper phase
- git add backend/app/scrapers backend/tests/test_cleaner.py backend/tests/test_scraper_runtime_guards.py
- git commit -m "scraper-phase: improve technical field extraction and guards"
- git push origin main
