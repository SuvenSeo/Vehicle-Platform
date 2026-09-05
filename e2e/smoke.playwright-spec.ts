/**
 * Motormila smoke suite (doc-only stub, B2-E test hardening).
 *
 * Playwright is NOT installed (no heavy deps added). To run:
 *   npm i -D @playwright/test && npx playwright install chromium
 *   npx playwright test e2e/smoke.playwright-spec.ts
 * Suggested package.json script (not added — test-only track):
 *   { "e2e:smoke": "playwright test e2e/smoke.playwright-spec.ts" }
 *
 * Filename note: `*.playwright-spec.ts` matches Playwright's default
 * testMatch (`.*(test|spec)\.(js|ts|mjs)`) while staying invisible to the
 * vitest default include (`*.spec.ts`), so `npm run test` stays green
 * without Playwright installed.
 *
 * Assumes: frontend dev server on :8080, backend on 127.0.0.1:8000 with
 * ALLOW_SQLITE_FALLBACK=true, PRO_ACCESS_ENFORCED=false,
 * APP_ACCESS_ENFORCED=false (see AGENTS.md). Seed one listing in
 * `car_listings` first — the DB starts empty — and clear
 * `market_stats_cache` after seeding so stats endpoints recompute.
 */
import { expect, test } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";

test.describe("motormila smoke", () => {
  test("login redirects anonymous visitors to sign-in", async ({ page }) => {
    await page.goto(`${BASE}/pro`);
    await expect(page).toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("search filters the listing feed", async ({ page }) => {
    await page.goto(`${BASE}/`);
    const search = page.getByRole("searchbox").first();
    await search.fill("Toyota Vitz");
    await expect(page.getByText(/vitz/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("listing detail renders price and deal signals", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.getByRole("link", { name: /vitz|toyota/i }).first().click();
    await expect(page).toHaveURL(/listing/);
    await expect(page.getByText(/Rs\./).first()).toBeVisible({ timeout: 15_000 });
  });

  test("pro gate locks premium surfaces for free users", async ({ page }) => {
    await page.goto(`${BASE}/pro`);
    await expect(page.getByText(/subscription required|pro is locked/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /view plans/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });
});
