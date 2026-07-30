#!/usr/bin/env node
/**
 * pull-vercel-snapshots.mjs
 *
 * Pulls snapshot data from the Motormila internal-snapshot-export API and
 * writes JSON files to public/snapshots/latest/.
 *
 * Requires Node 18+ (uses built-in fetch).
 *
 * Usage:
 *   SNAPSHOT_EXPORT_SECRET=<token> node scripts/pull-vercel-snapshots.mjs
 *
 * The token is sent as:
 *   Authorization: Bearer <token>
 * and also as query param ?token=<token> for APIs that prefer it.
 *
 * Exits non-zero on:
 *   - Missing token
 *   - HTTP 401/403 (auth failure)
 *   - HTTP 500/503 (DB / server failure)
 *   - Unexpected thrown errors
 */

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'snapshots', 'latest');

const BASE_URL = 'https://motormila.vercel.app/api/internal-snapshot-export';
const TOKEN = process.env.SNAPSHOT_EXPORT_SECRET;

if (!TOKEN) {
  console.error('ERROR: SNAPSHOT_EXPORT_SECRET env var is not set.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function fileSizeStr(filePath) {
  try {
    return formatBytes(statSync(filePath).size);
  } catch {
    return '(unknown)';
  }
}

/**
 * Fetch one page from the snapshot export endpoint.
 *
 * Returns the parsed JSON body, or `{ __unsupported: true, status }` when
 * the API returns a 404 / 422 (unknown kind) rather than an auth or DB error.
 *
 * Calls process.exit(1) on auth (401/403) or server (500/503) failures.
 */
async function fetchKind(kind, extraParams = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('kind', kind);
  url.searchParams.set('token', TOKEN); // secondary: query-param style
  for (const [k, v] of Object.entries(extraParams)) {
    url.searchParams.set(k, String(v));
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
      },
    });
  } catch (networkErr) {
    console.error(`\nNETWORK ERROR fetching kind="${kind}": ${networkErr.message}`);
    process.exit(1);
  }

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    console.error(
      `\nAUTH FAILURE (${res.status} ${res.statusText}) for kind="${kind}"` +
        (body ? ` — ${body.slice(0, 200)}` : ''),
    );
    process.exit(1);
  }

  if (res.status === 500 || res.status === 503) {
    const body = await res.text().catch(() => '');
    console.error(
      `\nSERVER/DB FAILURE (${res.status} ${res.statusText}) for kind="${kind}"` +
        (body ? ` — ${body.slice(0, 300)}` : ''),
    );
    process.exit(1);
  }

  if (!res.ok) {
    // 404, 422, etc. — treat as unsupported kind, don't abort
    return { __unsupported: true, status: res.status };
  }

  return res.json();
}

function writeJson(filename, data) {
  const filePath = join(OUT_DIR, filename);
  const content = JSON.stringify(data, null, 2);
  writeFileSync(filePath, content, 'utf8');
  console.log(`  ✓  ${filename.padEnd(30)} ${fileSizeStr(filePath)}`);
}

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

/** Straightforward single-request kinds */
const SIMPLE_KINDS = [
  { kind: 'stats-summary',   file: 'stats-summary.json' },
  { kind: 'live-market',     file: 'live-market.json' },
  { kind: 'district-prices', file: 'district-prices.json' },
  { kind: 'listing-makes',   file: 'listing-makes.json' },
  { kind: 'listing-sources', file: 'listing-sources.json' },
];

/**
 * Optional kinds: written with safe empty defaults when the API doesn't
 * recognise the kind (returns non-2xx other than auth/DB errors).
 */
const OPTIONAL_KINDS = [
  {
    kind: 'pipeline-status',
    file: 'pipeline-status.json',
    default: {
      status: 'unknown',
      pipelines: [],
      generated_at: new Date().toISOString(),
    },
  },
  {
    kind: 'dashboard-insights',
    file: 'dashboard-insights.json',
    default: {
      insights: [],
      generated_at: new Date().toISOString(),
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nMotormila snapshot pull`);
  console.log(`  Source : ${BASE_URL}`);
  console.log(`  Output : ${OUT_DIR}`);
  console.log(`  Time   : ${new Date().toISOString()}\n`);

  // --- simple kinds ---
  console.log('Simple kinds:');
  for (const { kind, file } of SIMPLE_KINDS) {
    process.stdout.write(`  Fetching ${kind} ... `);
    const data = await fetchKind(kind);
    if (data.__unsupported) {
      // Simple kinds are expected; warn but write an empty placeholder rather
      // than crashing so a partial run still yields usable files.
      console.log(`SKIPPED (HTTP ${data.status} — kind not supported by this deployment)`);
      writeJson(file, { __placeholder: true, kind, generated_at: new Date().toISOString() });
    } else {
      process.stdout.write('done\n');
      writeJson(file, data);
    }
  }

  // --- optional kinds ---
  console.log('\nOptional kinds:');
  for (const { kind, file, default: fallback } of OPTIONAL_KINDS) {
    process.stdout.write(`  Fetching ${kind} ... `);
    const data = await fetchKind(kind);
    if (data.__unsupported) {
      console.log(`not supported (HTTP ${data.status}) — writing defaults`);
      writeJson(file, fallback);
    } else {
      process.stdout.write('done\n');
      writeJson(file, data);
    }
  }

  // --- paginated listing catalog ---
  console.log('\nListing catalog (paginated, limit=1000 per page):');
  const allItems = [];
  let cursor = null;
  let page = 0;
  let listingsSupported = true;

  do {
    const params = { limit: 1000 };
    if (cursor) params.cursor = cursor;

    process.stdout.write(`  Page ${++page} (cursor=${cursor ?? 'start'}) ... `);
    const data = await fetchKind('listings', params);

    if (data.__unsupported) {
      console.log(`listings kind not supported (HTTP ${data.status}) — writing empty catalog`);
      listingsSupported = false;
      break;
    }

    // Support several common response shapes
    const pageItems =
      Array.isArray(data) ? data :
      Array.isArray(data.items) ? data.items :
      Array.isArray(data.listings) ? data.listings :
      Array.isArray(data.data) ? data.data :
      [];

    allItems.push(...pageItems);
    cursor =
      data.next_cursor ??
      data.nextCursor ??
      data.cursor ??
      null;

    console.log(`+${pageItems.length} items  (total so far: ${allItems.length})`);
  } while (cursor !== null);

  // Vercel static file limit is 100MB — split catalog into parts under budget.
  const MAX_PART_BYTES = 90 * 1024 * 1024;
  const generatedAt = new Date().toISOString();
  const monolithicBytes = Buffer.byteLength(
    JSON.stringify({
      items: allItems,
      generated_at: generatedAt,
      listing_count: allItems.length,
      paginated: listingsSupported,
    }),
    'utf8',
  );

  if (monolithicBytes <= MAX_PART_BYTES) {
    writeJson('listing-catalog.json', {
      items: allItems,
      generated_at: generatedAt,
      listing_count: allItems.length,
      paginated: listingsSupported,
    });
  } else {
    const partNames = [];
    let partIndex = 0;
    let partItems = [];
    let partBytes = Buffer.byteLength(
      JSON.stringify({ items: [], generated_at: generatedAt }),
      'utf8',
    );

    const flushPart = () => {
      if (partItems.length === 0) return;
      const name = `listing-catalog-part-${String(partIndex).padStart(3, '0')}.json`;
      writeJson(name, { items: partItems, generated_at: generatedAt });
      partNames.push(name);
      partIndex += 1;
      partItems = [];
      partBytes = Buffer.byteLength(
        JSON.stringify({ items: [], generated_at: generatedAt }),
        'utf8',
      );
    };

    for (const item of allItems) {
      const itemJson = JSON.stringify(item);
      const nextBytes = partBytes + Buffer.byteLength(itemJson, 'utf8') + 1;
      if (partItems.length > 0 && nextBytes > MAX_PART_BYTES) {
        flushPart();
      }
      partItems.push(item);
      partBytes += Buffer.byteLength(itemJson, 'utf8') + 1;
    }
    flushPart();

    writeJson('listing-catalog.json', {
      parts: partNames,
      generated_at: generatedAt,
      listing_count: allItems.length,
      paginated: listingsSupported,
    });
  }

  // --- summary ---
  console.log(`\nDone. Snapshot files written to ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message ?? err);
  process.exit(1);
});
