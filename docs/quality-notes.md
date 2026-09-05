# Quality notes — TRACK B2-E (test hardening, no feature changes)

Owned paths only: `src/test/*`, `backend/tests/*` (additive),
`e2e/` (new stub), this file. No routes/components/backend logic edited.

## Tests added / fixed

| # | File | Change | Result |
|---|------|--------|--------|
| 1 | `src/test/requireAuthAndFreePlan.test.tsx` | Fixed stale CTA assert: `View plans` → B1/B2 copy (`Upgrade` → `/pricing`, `Start 7-day free trial` → `/pricing`, `Start your 7-day free trial…` body). Banner body `You're on the Free plan…` (en.ts `freeBanner.body`) kept. | 3/3 pass (was 2/3) |
| 2 | `src/test/apiContract.test.ts` (NEW) | Read-only contract: 17 `api.ts` routes (stats, listings, pro, chat, feedback, calculators) asserted against FastAPI OpenAPI path snapshot dumped from `app.main` (2026-09-03). | 4/4 pass |
| 3 | `backend/tests/test_stats_cache_invalidation.py` (NEW) | Pins AGENTS.md gotcha: summary/district-prices/district-velocity serve stale-cached payload after listing inserts while TTL-fresh; recompute only after expiry. Plus 15-min vs 1-h TTL boundary test. | 4/4 pass |
| 4 | `e2e/smoke.playwright-spec.ts` + `e2e/README.md` (NEW) | Doc-only Playwright stub (login redirect, search, listing detail, pro gate). Playwright NOT installed — no heavy deps. `*.playwright-spec.ts` matches Playwright testMatch but stays out of vitest include, so `npm run test` is unaffected. Suggested script: `e2e:smoke`. | stub, not executed |

## Suite numbers

- Frontend `npm run test` (full): **81 files, 395 tests — 393 pass, 2 fail (pre-existing, out of scope, see below)**.
- Backend subset (`test_stats_cache.py` + `test_stats_cache_invalidation.py` + `test_discover_dump_releases.py`): **72 tests — 68 pass, 4 fail (pre-existing, see triage)**.

## Triage: `test_discover_dump_releases` 4 failures — PRE-EXISTING, not fixed

Failing: `test_extract_dump_timestamp_from_tag_or_bare_marker`,
`test_select_dumps_newer_than_full_tag_last_merged`,
`test_select_dumps_newer_than_bare_timestamp`,
`test_force_tag_selects_even_if_older_than_last_merged` (7 others pass).

Root cause: HEAD commit `80854e8` changed `extract_dump_timestamp` to
normalize to `YYYYMMDDTHHMMSSZ` (appends `00` seconds); the tests still
assert the old `YYYYMMDDTHHMMZ` strings (e.g. `20260818T154700Z` vs
expected `20260818T1547Z`, incl. `new_last` markers). Ordering/selection
logic is unaffected (both sides normalized before `>` comparison), so
merge-pipeline behaviour is intact — only exact-string assertions drift.
Per B2-E read-only rule: **documented, logic untouched**. Owner action:
update the 4 assertions to the `…SSZ` form (test-side change), no prod fix needed.

## Pre-existing frontend failures — OUT OF SCOPE (other tracks' working tree)

- `src/test/pricingDocsBranding.test.tsx` → renders pricing tiers/ICP personas.
- `src/test/proPreview.test.tsx` → `sign in to unlock` link.
Both assert copy against `src/pages/Pricing.tsx` / `ProPreview.tsx`, which
have uncommitted changes from other tracks. Untouched by B2-E.

## Risks

- Working tree carries many uncommitted changes from parallel tracks; B2-E
  asserts pass against current tree — re-run if B1/B2 copy lands differently.
- Contract snapshot drifts if backend adds/renames routes: regen via the
  one-liner in `apiContract.test.ts` header and update both sides together.
- e2e stub needs seeded `car_listings` + cleared `market_stats_cache`
  (AGENTS.md gotchas) before it can go green; empty-DB runs will fail.
- No backend/src logic touched; backend coverage here is additive tests only.
