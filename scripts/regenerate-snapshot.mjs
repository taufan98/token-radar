// regenerate-snapshot.mjs -- reproduce the sealed token-radar snapshot, compact.
//
// The snapshot for token-radar-01 is sealed house data: DefiLlama's protocol
// list fetched once on 2026-11-14. The live API serves today's list, so a fresh
// fetch would be a different snapshot and a different board; the sealed bytes
// are the only source of an equivalent copy. This script reads the kit's own
// copy of those sealed bytes, checks the structure the competition defines
// (date, source, floor, protocols sorted by slug with exactly ten fields each,
// a watchlist drawn from them), and writes the entry's local copy in compact
// form -- one line of JSON. The entry program reads the file with JSON.parse,
// so the compact form scores exactly like the pretty-printed one, and the
// board it derives is byte-identical.
//
//   node scripts/regenerate-snapshot.mjs --source <sealed snapshot.json> --out input/snapshot.json
//
// The script verifies its own output: it reads the written file back, parses
// it, and compares it field by field with the source before reporting success.
// It never touches the network.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIELDS = ['slug', 'name', 'category', 'chains', 'tvl_usd', 'change_7d', 'mcap_usd', 'listed_at', 'gecko_id', 'symbol'];

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

function fail(message) {
  process.stderr.write(`regenerate-snapshot: ${message}\n`);
  process.exit(1);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

const sourcePath = arg('source', null);
if (sourcePath === null) fail('pass --source <sealed snapshot.json>');
const outPath = resolve(arg('out', 'input/snapshot.json'));

let source;
try {
  source = JSON.parse(readFileSync(sourcePath, 'utf8'));
} catch (err) {
  fail(`cannot read ${sourcePath}: ${err.message}`);
}
if (typeof source !== 'object' || source === null || Array.isArray(source)) fail('source is not a JSON object');
if (typeof source.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.as_of)) fail('source has no as_of date');
if (typeof source.source !== 'string' || source.source === '') fail('source has no source string');
if (!Number.isSafeInteger(source.floor_usd) || source.floor_usd <= 0) fail('source has no floor_usd');
if (!Array.isArray(source.protocols) || source.protocols.length === 0) fail('source has no protocols array');
if (!Array.isArray(source.watchlist)) fail('source has no watchlist array');

const slugs = new Set();
let previous = null;
for (let i = 0; i < source.protocols.length; i++) {
  const p = source.protocols[i];
  if (typeof p !== 'object' || p === null || Array.isArray(p)) fail(`protocol ${i} is not an object`);
  const keys = Object.keys(p);
  if (keys.length !== FIELDS.length || !FIELDS.every((f) => Object.prototype.hasOwnProperty.call(p, f))) {
    fail(`protocol ${i} does not carry exactly the ten snapshot fields`);
  }
  if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
    fail(`protocol ${i} lacks a slug, a name or a TVL`);
  }
  if (previous !== null && p.slug <= previous) fail(`protocols are not sorted by slug (out of order at ${p.slug})`);
  previous = p.slug;
  slugs.add(p.slug);
}
for (const s of source.watchlist) {
  if (typeof s !== 'string' || !slugs.has(s)) fail(`watchlist names ${s}, which is not a protocol in the snapshot`);
}

const out = {
  as_of: source.as_of,
  source: source.source,
  floor_usd: source.floor_usd,
  protocols: source.protocols,
  watchlist: source.watchlist,
};
writeFileSync(outPath, `${JSON.stringify(out)}\n`);

let written;
let raw;
try {
  raw = readFileSync(outPath, 'utf8');
  written = JSON.parse(raw);
} catch (err) {
  fail(`cannot read back ${outPath}: ${err.message}`);
}
if (!deepEqual(written, source)) fail('written file does not parse back to the source data');

process.stdout.write(
  `regenerate-snapshot: ${source.protocols.length} protocols, ${source.watchlist.length} on the watchlist, as_of ${source.as_of}\n` +
  `regenerate-snapshot: wrote ${outPath} (${Buffer.byteLength(raw)} bytes, 1 line, deep-equal to the sealed source)\n`,
);
