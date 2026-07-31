#!/usr/bin/env node
/**
 * split-listing-catalog.mjs
 *
 * Splits a monolithic listing-catalog.json ({ items: [...] }) into
 * Vercel-safe parts (<90MB each) under the same directory.
 *
 * Usage:
 *   node scripts/split-listing-catalog.mjs [path/to/listing-catalog.json]
 *
 * Default path: public/snapshots/latest/listing-catalog.json
 */

import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_PATH = join(ROOT, 'public', 'snapshots', 'latest', 'listing-catalog.json');
const MAX_PART_BYTES = 90 * 1024 * 1024;

const catalogPath = resolve(process.argv[2] || DEFAULT_PATH);
if (!existsSync(catalogPath)) {
  console.error(`ERROR: missing ${catalogPath}`);
  process.exit(1);
}

const outDir = dirname(catalogPath);
const raw = JSON.parse(readFileSync(catalogPath, 'utf8'));
const items = Array.isArray(raw.items) ? raw.items : [];
const generatedAt = raw.generated_at || new Date().toISOString();

const monolithic = JSON.stringify({
  items,
  generated_at: generatedAt,
  listing_count: items.length,
});

if (Buffer.byteLength(monolithic, 'utf8') <= MAX_PART_BYTES) {
  writeFileSync(
    catalogPath,
    JSON.stringify({
      items,
      generated_at: generatedAt,
      listing_count: items.length,
    }),
  );
  console.log(`OK single-file catalog (${items.length} items, ${statSync(catalogPath).size} bytes)`);
  process.exit(0);
}

const partNames = [];
let partIndex = 0;
let partItems = [];
let partBytes = Buffer.byteLength(JSON.stringify({ items: [], generated_at: generatedAt }), 'utf8');

const flush = () => {
  if (partItems.length === 0) return;
  const name = `listing-catalog-part-${String(partIndex).padStart(3, '0')}.json`;
  const path = join(outDir, name);
  writeFileSync(path, JSON.stringify({ items: partItems, generated_at: generatedAt }));
  console.log(`  wrote ${name} (${partItems.length} items, ${statSync(path).size} bytes)`);
  partNames.push(name);
  partIndex += 1;
  partItems = [];
  partBytes = Buffer.byteLength(JSON.stringify({ items: [], generated_at: generatedAt }), 'utf8');
};

for (const item of items) {
  const itemJson = JSON.stringify(item);
  const next = partBytes + Buffer.byteLength(itemJson, 'utf8') + 1;
  if (partItems.length > 0 && next > MAX_PART_BYTES) flush();
  partItems.push(item);
  partBytes += Buffer.byteLength(itemJson, 'utf8') + 1;
}
flush();

writeFileSync(
  catalogPath,
  JSON.stringify({
    parts: partNames,
    generated_at: generatedAt,
    listing_count: items.length,
  }),
);
console.log(`OK multi-part manifest (${partNames.length} parts, ${items.length} items)`);
