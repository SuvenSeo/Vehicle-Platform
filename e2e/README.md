# e2e smoke (doc-only stub)

Playwright is intentionally **not** installed — B2-E adds no heavy deps.

## Run (once Playwright is available)

```bash
npm i -D @playwright/test
npx playwright install chromium
npx playwright test e2e/smoke.playwright-spec.ts
```

Suggested npm script (documented here, not added to `package.json` by the
test-hardening track):

```json
{ "scripts": { "e2e:smoke": "playwright test e2e/smoke.playwright-spec.ts" } }
```

## Env

- `E2E_BASE_URL` (default `http://localhost:8080`)
- Backend on `127.0.0.1:8000` with `ALLOW_SQLITE_FALLBACK=true`,
  `PRO_ACCESS_ENFORCED=false`, `APP_ACCESS_ENFORCED=false`.
- Seed `car_listings` first (DB starts empty), then delete
  `market_stats_cache` rows to force stats recompute.

## Coverage

`smoke.playwright-spec.ts`: login redirect → sign-in, search filter,
listing detail (price/deal signals), pro gate (`/pro` → Subscription required
+ View plans). The `*.playwright-spec.ts` name matches Playwright's default
testMatch while staying out of vitest's default include, so `npm run test`
stays green with no Playwright installed.
