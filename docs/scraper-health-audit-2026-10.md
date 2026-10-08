# Scraper / Pipeline Health Audit — Motormila fleet

**Audited:** 2026-10-08 · workspace `/workspace` (backend `app/scrapers/*`)
**Task:** `task_0003` — Audit scraper + pipeline health and report

---

## 1. Method & evidence sources

| # | Evidence | How obtained |
|---|----------|--------------|
| E1 | Authoritative pipeline payload (generated_at `2026-10-08T02:39:47.841529+00:00`, `overall_status=delayed`) | Captured from hourly *Monitor Vehicle Pipeline* run **37718942106** via `gh` (relayed in mailbox; the endpoint is admin-gated — see E4) |
| E2 | Scraper test suite | `ALLOW_SQLITE_FALLBACK=true backend/.venv/bin/python -m pytest <12 files> -q -p no:cacheprovider --timeout=120` → **202 passed in 1.85s** |
| E3 | Live HTTP probes from this sandbox | `curl -sS -o /tmp/b.html -w '%{http_code}' --max-time 25 <url>` + body grep for `just a moment / attention required / checking your browser / human verification / verify you are human / are you a robot` |
| E4 | Live pipeline status re-fetch | `curl -sS -L 'https://seo292-vehicle-platform-backend.hf.space/api/v1/pipeline/status'` → **HTTP 401 `{"detail":"Authentication required."}`** (no `ADMIN_API_KEY` in sandbox; E1 stands as the authoritative payload) |
| E5 | Production run logs (ground truth) | `gh run view --job <id> --log` for GitHub run **37671628186** (daily-scrape, 2026-10-07T19:03:49Z). Job ids: saleme `112964616591`, riyasewana `112964617714`, patpat `112964616714`, auto-lanka `112964616709`, dimo `112964616559`, riyahub `112964616705` |
| E6 | Source/config inspection | `app/scrapers/*.py`, `run_sync.py`, `app/api/v1/endpoints/pipeline.py`, `app/services/source_aliases.py`, `.github/workflows/daily-scrape.yml`, `.github/workflows/pipeline-monitor.yml` |

**Run config for E5** (`daily-scrape.yml`): `SCRAPE_MAX_PAGES=20`; per-source caps `30`; `SCRAPE_SOURCE_TIMEOUT_SECONDS_SALEME=2700`, `_RIYAHUB=2700`, others `2400`; `RIYASEWANA_ARCHIVE_FALLBACK=0`; `continue-on-error` only for `riyasewana`/`patpat`; job timeout at line 51:

```yaml
timeout-minutes: ${{ contains(fromJSON('["ikman","riyasewana"]'), matrix.source) && 180 || 60 }}
```

so **only ikman/riyasewana get 180 min; every other source gets 60 min.**

---

## 2. Fleet health table

| Source (canonical) | Scraper / BASE host | Live HTTP (E3) | Bot-walled? | Parser tests (E2) | Pipeline verdict (E1) | Verdict | Evidence |
|---|---|---|---|---|---|---|---|
| `ikman` | `ikman.py` / `www.ikman.lk` | **301** → `http://ikman.lk/...` then 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T20:26:38Z | **Healthy** | 301 is the www→apex redirect; scraper uses `follow_redirects=True`. `server: cloudflare` but no challenge. |
| `riyasewana` | `riyasewana.py` / `riyasewana.com` | **403** | **YES** (`Attention Required! \| Cloudflare`) | ✅ pass (http-mode 14 + archive 6) | **delayed** · last=FAILED 2026-10-07T19:13:29Z | **Blocked (Cloudflare)** | E5: `riyasewana_http_fallback_to_playwright error='HTTP 403 ...'` → `scraping_source_failed error='riyasewana.com blocked the live scrape (playwright_blocked); archive fallback disabled'` |
| `patpat` | `patpat.py` / `patpat.lk` | **403** | **YES** (`Attention Required! \| Cloudflare`) | ✅ pass | **delayed** · last=FAILED 2026-10-07T19:14:34Z | **Blocked (Cloudflare)** | E5: `scraping_source_failed error='patpat.lk blocked the request ... (HTTP 403: bot_wall:title:attention_required:403)'` |
| `saleme` | `saleme.py` / `www.saleme.lk` | **403** | **YES from this sandbox** (`Just a moment...`); *not* walled from the GH runner | ✅ pass (depth 39) | **delayed** · last=FAILED 2026-10-07T20:11:43Z | **Timing out (throughput)** | E5: `scraping_source_timeout listings_new=0 source=saleme status=FAILED timeout_seconds=2700`; only **13** `scraping_page` lines, **0** empty pages, **0** blocked, **0** item/page errors |
| `autolanka` | `autolanka.py` / `www.autolanka.com` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T19:24:50Z | **Healthy** | Body grep for challenge markers: none (the word `captcha` does not appear in the HTML) |
| `auto-lanka` | `auto_lanka_site.py` / `auto-lanka.com` | 200 | no | ✅ pass | **ABSENT from job list** ⚠️ | **Healthy but invisible** | E5 job `scrape-source (auto-lanka)`: `scraping_source_completed source=auto-lanka`, `sync_completed duration_seconds=500.71`, checkpoint `total_listings=963`. Cause: §4 |
| `autodirect` | `autodirect.py` / `api.autodirect.lk` | API `…/vehicle/find` **200** (real JSON, `total:50`); web `www.autodirect.lk/cardetails/…` 403 | no (web 403 irrelevant) | ✅ pass | ok · last=SUCCESS 2026-10-07T19:13:58Z | **Healthy** | Scraper only calls the API (`client.get` at `autodirect.py:106,151`); `_build_detail_url` (line 257) builds the stored `url` field and is never fetched |
| `autostream` | `autostream.py` / `www.autostream.lk` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T19:33:28Z | **Healthy** | — |
| `carshop` | `carshop.py` / `www.carshop.lk` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T19:23:05Z | **Healthy** | — |
| `riyahub` | `riyahub.py` / `riyahub.lk` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T09:18:40Z | **Cancelled at 60-min job cap** ⚠️ | E5: job `cancelled` after 1h0m29s, `##[error]The operation was canceled.`; "ok" is masked — see §5 |
| `dimo` | `dimo.py` / `carsatdimo.lk` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T08:41:08Z | **Cancelled at 60-min job cap** ⚠️ | E5: job `cancelled` after 1h0m20s, `##[error]The operation was canceled.`; "ok" is masked — see §5 |
| `hitad` | `hitad.py` / `www.hitad.lk` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T19:42:19Z | **Healthy** | Body match `cloudflare` is a normal `cdn-cgi/.../email-decode.min.js` asset |
| `cartivate` | `cartivate.py` / `cartivatemotors.lk` | 200 | no | ✅ pass | ok · last=SUCCESS 2026-10-07T19:43:09Z | **Healthy** | — |
| `permitsale` *(not a listing source)* | `permitsale.py` / `permitsale.lk` | n/a | n/a | ✅ pass (13) | n/a | **Out of fleet scope** | Seeder for `VehiclePermit` prices; deliberately not in `SOURCE_REGISTRY` / `SOURCE_ORDER` |

`overall_status=delayed` is derived from **core sources only** (`ikman`, `riyasewana`; `pipeline.py:57,300-307`), so `riyasewana` alone forces the fleet status; patpat/saleme do not drive it.

**Parser/guard suite (E2): 202 passed, 0 failed.** `test_new_source_parsers` 13, `test_cleaner` 26, `test_scraper_net` 6, `test_scraper_runtime_guards` 24, `test_scraper_bot_wall_guards` 34, `test_riyasewana_http_mode` 14, `test_riyasewana_archive_fallback` 6, `test_permitsale_scraper` 13, `test_source_quality` 8, `test_scraper_payload_guards` 6, `test_scraper_depth_limits` 39, `test_scrape_circuit_breaker` 13.


---

## 3. Root-cause notes for the delayed sources

### 3.1 `riyasewana` — Cloudflare wall on both HTTP and Playwright; archive fallback intentionally off
- Live probe (E3): `403`, title `Attention Required! | Cloudflare`.
- Production (E5): HTTP mode gets `403` on `https://riyasewana.com/search/cars` → falls back to Playwright → still blocked → aborts: `riyasewana.com blocked the live scrape (playwright_blocked); archive fallback disabled`.
- The archive fallback is deliberately disabled (`RIYASEWANA_ARCHIVE_FALLBACK: "0"`; workflow comment: *"Hosted runners cannot pass riyasewana Cloudflare; don't hide that behind a zero-insert Wayback fallback"*). FAILED is therefore the **intended, honest** outcome — not a code defect.
- Block detection works as designed: `app/scrapers/net.py::blocked_response_reason` matches `attention required` in `<title>` → `bot_wall:title:…`, and the scraper aborts instead of burning its whole budget.

### 3.2 `patpat` — Cloudflare wall
- Live probe (E3): `403`, title `Attention Required! | Cloudflare`.
- Production (E5): `patpat.lk blocked the request for https://patpat.lk/en/sri-lanka/vehicle/car (HTTP 403: bot_wall:title:attention_required:403)`.
- Same root cause as riyasewana: Cloudflare rejects the datacentre runner IP. Not a parser/code defect (34 bot-wall-guard tests pass). `continue-on-error` keeps the workflow green while the run is truthfully recorded FAILED.

### 3.3 `saleme` — wall-clock timeout because per-page cost ≫ budget (not unbounded, not blocked)
Hard evidence from the saleme job log (E5) — listing-page timestamps:

| page | URL | wall time since previous page |
|---|---|---|
| 1 | `/ads/sri-lanka/cars` | — (start 19:26:39) |
| 2 | `?page=2` | **229 s** |
| 3 | `?page=3` | 209 s |
| 4 | `?page=4` | 245 s |
| 5 | `?page=5` | 223 s |
| 6 | `?page=6` | 229 s |
| 7 | `?page=7` | 213 s |
| 8 | `?page=8` | 259 s |
| 9 | `?page=9` | 181 s |
| 10 | `?page=10` | 234 s |
| 11 | `?page=11` | 205 s |
| 12 | `?page=12` | 189 s |
| 13 | `?page=13` | 210 s |
| — | **timeout** 20:11:44 | `listings_new=0 status=FAILED timeout_seconds=2700` |

Findings:
1. **The crawl is bounded — it is not a runaway loop.** `GenericDetailScraper.scrape` caps each category at `SCRAPE_MAX_PAGES_SALEME=30` and stops a category after `EMPTY_PAGE_LIMIT=3` consecutive empty pages (`generic_detail.py:409-521`). The log shows **0** `generic_detail_empty_page`, **0** `generic_detail_item_error`, **0** `generic_detail_page_error`, **0** block events.
2. **The planned budget is ~150 listing pages** (5 categories × 30: `saleme.py::START_URLS` + `page_budget_for_category`). In 2700 s only **13** pages completed — page 13 of the *cars* category; the other 4 categories were never reached (13/150 ≈ 8.7%).
3. **Per-page cost is ~180–260 s.** The loop fetches every ad's detail page **strictly sequentially** (`for detail_url in listing_urls: detail = await client.get(detail_url, timeout=30)` — no concurrency, no per-page detail cap). At a typical ~40 ads/page that is ~5–6 s per detail request; the arithmetic (~40 × 5.5 s ≈ 220 s) matches the observed cadence. *(Inference — we have page-to-page deltas, not per-request timings.)*
4. **Business impact: the source is effectively frozen.** Every run re-reads pages 1–13 of the cars category and returns `listings_new=0`, so the run is recorded FAILED and the crawl never progresses into pages 14–30 or the other 4 categories. Any new inventory beyond page 13 is never ingested; `last_success` is over a month stale (2026-09-08 per task brief / E1).
5. **Classification: throughput / wall-clock mismatch, not a hard code bug.** The loop terminates by design; the config (`30` pages × `5` categories with sequential detail fetches) simply cannot fit in `2700 s`.
6. **Sandbox vs runner nuance (risk):** from this sandbox `www.saleme.lk` is Cloudflare-challenged (`403 Just a moment...`), while the GH runner received real content (13 pages, no block event). Saleme is IP-reputation sensitive — a runner-IP change could flip it from "slow timeout" to "hard blocked". Note the lead also observed one run where saleme finished in 57m42s, so it is **borderline/flaky**, not deterministically broken.


---

## 4. `auto-lanka` runs but is invisible in `pipeline/status` — canonical-key collision (real defect)

`AutoLankaSiteScraper` (`app/scrapers/auto_lanka_site.py:20`) has `SOURCE = "auto-lanka"` (host `auto-lanka.com`) and is a **different site** from `AutoLankaScraper` (`app/scrapers/autolanka.py:19`, `SOURCE = "autolanka"`, host `www.autolanka.com`). Both run in the daily matrix (`.github/workflows/daily-scrape.yml:56`).

But `canonical_source_key()` collapses them:

```
$ backend/.venv/bin/python -c "from app.services.source_aliases import canonical_source_key as c; print(c('auto-lanka'), c('autolanka'))"
autolanka autolanka          # <- collision
```

`_compact_source_token("auto-lanka")` strips `-` → `"autolanka"`, which matches the `{"autolanka","autolankacom","autolankalk","autolankasite"}` branch (`source_aliases.py:30-52`). `pipeline_status` groups every run through `_canonical_source(run.source)` (`pipeline.py:118-119,220-244`), so `auto-lanka` rows merge into the `scrape_autolanka` job. Consequences:

- There is **no `scrape_auto-lanka` job**, so auto-lanka's health is unreportable (matches the mailbox observation).
- The single `scrape_autolanka` job's `last_status` / `last_success` / `last_error` reflect whichever of the two scrapers ran most recently (`_pick_preferred_run` picks max `started_at`), so the two sources' states silently flip-flop.
- `EXPECTED_HOURS` has no `auto-lanka` key → it would inherit the 12 h default even if listed.
- It is "intentional" only in the narrow sense that `tests/test_source_aliases.py:10` asserts `canonical_source_key("auto-lanka") == "autolanka"`. But the same alias group's members (`autolankacom`, `autolankalk`) show the group exists to fold **spellings of autolanka.com**, whereas `auto-lanka` is a **different domain**. `run_sync.py:246` even comments *"Prefer exact keys first so auto-lanka and autolanka remain distinct"* — the runner keeps them distinct while the status layer merges them. That is a genuine observability/correctness defect, not a spelling alias.

Evidence that auto-lanka is genuinely healthy despite being invisible: E5 job `scrape-source (auto-lanka)` → `scraping_source_completed source=auto-lanka`, `sync_completed duration_seconds=500.71`, checkpoint `total_listings=963`; live probe `auto-lanka.com/Default.aspx?type=Cars&page=2` → 200, no challenge.

---

## 5. `dimo` + `riyahub` are cancelled at the 60-minute job cap every run (masked as "ok")

**Root cause:** `.github/workflows/daily-scrape.yml:51` gives only `ikman`/`riyasewana` 180 min; every other source gets 60 min:

```yaml
timeout-minutes: ${{ contains(fromJSON('["ikman","riyasewana"]'), matrix.source) && 180 || 60 }}
```

**Evidence (E5, run 37671628186):** the two heavy non-Cloudflare sources need longer than 60 min, so they are cancelled mid-scrape:

| job | started | ended | duration | conclusion | log tail |
|---|---|---|---|---|---|
| `scrape-source (dimo)` | 19:23:13 | 20:23:33 | **1h0m20s** | `cancelled` | `##[error]The operation was canceled.` + `Terminate orphan process: pid (2143) (python)` |
| `scrape-source (riyahub)` | 19:14:45 | 20:15:14 | **1h0m29s** | `cancelled` | `##[error]The operation was canceled.` |

*(The cancelled step's live log is not retained in the run artifact — only setup lines are present — so per-page progress for these two could not be read from the log; the durations and cancel markers above are the evidence.)*

**Why `pipeline/status` still shows them "ok" (misleading):** `reconcile_orphan_running_runs` (`pipeline.py:161-196`, `ORPHAN_RUNNING_MINUTES = 90`) later marks the abandoned `RUNNING` row `FAILED` with the sentinel error `ORPHAN_RUNNING_ERROR`. The status rule at `pipeline.py:390-397` then **excludes** that sentinel from the `delayed` branch:

```python
elif last_status == "FAILED" and raw_error != ORPHAN_RUNNING_ERROR:
    status = "delayed"
elif success_at and now - success_at <= timedelta(hours=expected_hours * 1.5):
    status = "ok"
```

so dimo/riyahub fall through to the freshness check. Both are only just inside the 18 h window at snapshot time (`expected_hours=12 × 1.5`):

- dimo: last_success `2026-10-07T08:41:08Z` vs snapshot `2026-10-08T02:39:47Z` → **17 h 58 m 39 s** (inside 18 h by 1 m 21 s).
- riyahub: last_success `2026-10-07T09:18:40Z` → **17 h 21 m 07 s** (inside by 38 m 53 s).

**Prediction:** absent a successful run, both flip to `delayed` in the next hourly snapshots (dimo ~02:41Z, riyahub ~03:19Z). So the current "ok" is a **transient artefact** of the orphan carve-out plus a barely-inside freshness window — the real condition is "cancelled every run, no fresh inventory".

**Secondary effect of the job-cap cancellation:** the scrape is killed mid-run, so its `ScrapeRun` row is left `RUNNING` and is only corrected when the orphan reconciler fires 90 min later. Until then the source can even appear `running` on the dashboard.


---

## 6. Recommendations (priority order)

1. **`dimo` / `riyahub` — raise the job cap (or cut their page budget).** They are cancelled every run by the 60-min `timeout-minutes` line. Either add them to the 180-min branch of `daily-scrape.yml:51` (they are not Cloudflare-walled, so the extra time is usable), or lower `SCRAPE_MAX_PAGES_DIMO` / `SCRAPE_MAX_PAGES_RIYAHUB` from `30` so a run finishes inside 60 min. Prefer raising the cap for dimo/riyahub and keeping their depth.
2. **`saleme` — fix the throughput budget (config-only, no code risk).** Make the per-run workload fit the timeout: lower `SCRAPE_MAX_PAGES_SALEME` from `30` to ~`6`–`8`, **and/or** rotate `SALEME_START_PAGE` between runs so successive runs walk deeper into the catalogue (`page_budget.start_page_from_env` already supports `<SOURCE>_START_PAGE`). Do **not** merely raise the timeout — the workflow comment pins source timeouts below the 60-min job cap and `2700 s` is already 45 min.
3. **`saleme` — follow-up (code, higher risk):** add bounded concurrency for detail fetches in `GenericDetailScraper` (today fully sequential) via a small semaphore + per-page detail cap. This is the real fix for the ~220 s/page cost but touches the shared base class used by 4 sources, so it deserves its own task + tests.
4. **`auto-lanka` — separate the canonical key.** Give `auto-lanka` its own alias group for the `.com` site (e.g. `{"auto-lanka","autolanka","autolankacom"}` mapped to a distinct key), add it to `pipeline.py::SOURCE_ORDER` + `EXPECTED_HOURS`, and update `tests/test_source_aliases.py:10`. Restores per-source visibility and stops the two sites' statuses from overwriting each other.
5. **`riyasewana` / `patpat` — treat as an access problem, not a scraper bug.** Both are Cloudflare-walled for the hosted runner. Options: route them through residential/rotating proxies (`SCRAPE_PROXIES` / `SCRAPE_PROXY_URL` are already plumbed in `net.py`) or accept the honest FAILED state. Keep `RIYASEWANA_ARCHIVE_FALLBACK=0` (a zero-insert fallback would mask the outage).
6. **Observability gaps to fix in `pipeline/status`:**
   - `listings_new=0` is conflated with "broken": `run_sync.py:560-566` records FAILED when a timed-out source added no *new* rows, even when it successfully re-upserted existing ones (saleme's case). Distinguish "crawl completed, catalogue unchanged" from "crawl failed".
   - The orphan-sentinel carve-out (`pipeline.py:392`) lets a source that is cancelled *every run* keep reading "ok" until its last success ages out — consider surfacing `cancelled/orphan` distinctly.
7. **Out of scraper scope, for the record:** the lead reports `snapshot-export` failed with `column car_listings.images does not exist` (already fixed via `backend/db/schema_patches.py`). Not a scraper issue; noted so it is not mis-attributed to a source.
8. **No action needed:** `ikman`, `autolanka`, `autodirect`, `autostream`, `carshop`, `hitad`, `cartivate` are all live-reachable (200 / API 200) and last ran SUCCESS.

---

## 7. Files changed

**None.** No scraper source file was modified: the parser/guard suite is green (202/202), no clear *safe* code bug was found in the delayed sources, and every identified fix is either config-level (rec. 1, 2, 5) or a shared-base-class / alias-layer change that warrants its own task and tests (rec. 3, 4). No git commands were run.

## 8. Limitations

- `GET /api/v1/pipeline/status` is admin-gated (**401** from this sandbox, E4), so E1 (the `gh`-captured payload) is used as the authoritative pipeline snapshot; it could not be re-derived live.
- Per-request detail timing for saleme is not logged; the ~5–6 s/detail figure in §3.3 is inferred from the page-to-page deltas (arithmetic shown).
- The cancelled `dimo`/`riyahub` steps do not retain live logs in the run artifact, so their per-page progress could not be measured (durations + cancel markers used instead).
- `listings_new=0` for saleme cannot be decomposed further (upsert logging is at debug level) without admin-key access to fuller logs.

