// Applies the reviewed rows of subregion-proposals.csv to the wine collection.
// Only rows whose VERDICT column is exactly "APPLY" are written; everything else is
// reported and skipped. Companion to propose-subregions.js, which generates the CSV.
//
//   node --env-file-if-exists=.env server/scripts/apply-subregion-proposals.js --dry-run
//   node --env-file-if-exists=.env server/scripts/apply-subregion-proposals.js --i-reviewed-the-dry-run
//
// Requires MONGODB_URI. Back up first, and read the backup output.
const fs = require('fs');
const path = require('path');
const { readData, writeData } = require('../dataStore');
const db = require('../db');
const { ensureRegionCoordinates } = require('../geocoding');
const WINE_REGIONS = require('../../client/src/data/wine-regions.json');

const SEP = ' / ';
const CSV = path.join(__dirname, '../../subregion-proposals.csv');

function parseLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function readCsv() {
  const lines = fs.readFileSync(CSV, 'utf8').split('\r\n').filter(Boolean);
  const head = parseLine(lines[0]);
  const col = name => head.indexOf(name);
  return lines.slice(1).map(parseLine).map(r => ({
    id: r[col('id')],
    label: `${r[col('producer')]} ${r[col('name')]}`.trim(),
    country: r[col('country')],
    current: r[col('current_region')],
    proposed: r[col('proposed_region')],
    verdict: r[col('VERDICT')],
    reason: r[col('REASON')],
  }));
}

function flatten(node, prefix = []) {
  const join = name => [...prefix, name].join(SEP);
  if (Array.isArray(node)) return node.map(join);
  return Object.entries(node).flatMap(([name, child]) => [join(name), ...flatten(child, [...prefix, name])]);
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(parseLine('a,b,c'), ['a', 'b', 'c']);
  assert.deepStrictEqual(parseLine('a,"b,c",d'), ['a', 'b,c', 'd']);
  assert.deepStrictEqual(flatten({ A: ['B'] }), ['A', 'A / B']);
}

async function run({ write }) {
  const rows = readCsv();
  const wines = await readData('wine');
  const byId = new Map(wines.map(w => [w.id, w]));

  const toApply = [];
  const problems = [];
  for (const r of rows) {
    if (r.verdict !== 'APPLY') continue;
    const wine = byId.get(r.id);
    if (!wine) { problems.push(`${r.id} no longer exists`); continue; }
    if (wine.region === r.proposed) { problems.push(`${r.label}: already ${r.proposed}`); continue; }
    // Never write a region the taxonomy doesn't know -- the admin form would flag it.
    if (!flatten(WINE_REGIONS[r.country] ?? {}).includes(r.proposed)) {
      problems.push(`${r.label}: "${r.proposed}" not in taxonomy for ${r.country}`);
      continue;
    }
    // The proposal must refine what's stored, never contradict it.
    if (wine.region && !r.proposed.startsWith(wine.region + SEP)) {
      problems.push(`${r.label}: "${r.proposed}" is not under stored "${wine.region}"`);
      continue;
    }
    toApply.push({ wine, proposed: r.proposed, from: wine.region || '(none)' });
  }

  console.log(`\n=== WILL BE WRITTEN (${toApply.length}) ===`);
  toApply.forEach(({ wine, proposed, from }) =>
    console.log(`  ${(wine.producer + ' ' + (wine.seriesAndName || '')).trim().slice(0, 40).padEnd(42)} ${from} -> ${proposed}`));

  console.log(`\n=== SKIPPED BY VERDICT (${rows.filter(r => r.verdict !== 'APPLY').length}) ===`);
  const reasons = {};
  rows.filter(r => r.verdict !== 'APPLY').forEach(r => { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
  Object.entries(reasons).forEach(([k, v]) => console.log(`  ${String(v).padStart(2)}  ${k}`));

  console.log(`\n=== REJECTED BY SAFETY CHECKS (${problems.length}) ===`);
  problems.forEach(p => console.log('  ' + p));
  if (!problems.length) console.log('  (none)');

  if (!write) { console.log('\nNo changes written.\n'); return; }

  toApply.forEach(({ wine, proposed }) => { wine.region = proposed; });
  await writeData('wine', wines);
  console.log(`\nwine: ${toApply.length} regions updated`);

  // New paths need map pins; best-effort, same as the app's own save path.
  let geocoded = 0;
  for (const { wine, proposed } of toApply) {
    try { await ensureRegionCoordinates(wine.country, proposed); geocoded++; } catch { /* best effort */ }
  }
  console.log(`geocoding attempted for ${geocoded} entries`);
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  const write = process.argv.includes('--i-reviewed-the-dry-run');
  if (!write && !process.argv.includes('--dry-run')) {
    console.error('Pass --dry-run, or --i-reviewed-the-dry-run to write.');
    process.exit(1);
  }
  await run({ write });
  await db.close();
}

selfTest();
main().catch(e => { console.error(e.message); process.exit(1); });
