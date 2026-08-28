// One-time region data cleanup. Five operations, all reviewable via --dry-run first:
//   1. nest flat sub-regions into their full path ("Chianti" -> "Toscana / Chianti")
//   2. rename regions to their standard names ("Judea" -> "Judean Hills")
//   3. move cached map coordinates to the new keys so existing pins survive
//   4. correct a wrong stored coordinate (Alsace)
//   5. trim trailing whitespace on country/region, and drop a confirmed-blank row
//
// Run the dry run FIRST and review every proposed line:
//   node --env-file-if-exists=.env server/scripts/migrate-region-cleanup.js --dry-run
// Then, once REWRITES below reflects what you approved:
//   node --env-file-if-exists=.env server/scripts/migrate-region-cleanup.js --i-reviewed-the-dry-run
//
// Requires MONGODB_URI in the environment.
// Back up first, and READ ITS OUTPUT -- backup-data.js exits 0 when it silently skips:
//   node --env-file-if-exists=.env server/scripts/backup-data.js
const { readData, writeData } = require('../dataStore');
const db = require('../db');
// ponytail: the taxonomy lives with the client because that's what consumes it; a one-off
// script reaching across is cheaper than inventing a shared module for a single reader.
const WINE_REGIONS = require('../../client/src/data/wine-regions.json');

const CATEGORIES = ['wine', 'whiskey'];
const SEP = ' / ';

// Old region value -> new region value. Nesting and plain corrections use the same
// mechanism, so a confirmed typo (e.g. 'Malborough': 'Marlborough') belongs here too.
// Every line must be verified against the dry run before this is run for real.
//
// Chianti Classico is its own DOCG -- a sibling of Chianti, not a subzone of it.
const REWRITES = {
  // --- nesting a sub-region under its parent ---
  'Chianti':               'Toscana / Chianti',
  'Chianti Classico':      'Toscana / Chianti Classico',
  'Valpolicella':          'Veneto / Valpolicella',
  'Salento':               'Puglia / Salento',
  'Primitivo di Manduria': 'Puglia / Primitivo di Manduria',
  'Porto':                 'Douro / Porto',        // Port is grown in the Douro
  'Côtes Catalanes':       'Languedoc-Roussillon / Côtes Catalanes',
  'Terre di Chieti':       'Abruzzo / Terre di Chieti',
  'Valpolicella Ripasso':  'Veneto / Valpolicella Ripasso', // own DOC, sibling of Valpolicella
  // --- corrections ---
  'Bordueax Medoc':        'Bordeaux / Médoc',     // misspelling + wrong level
  'Island':                'Islands',              // Scotch region is plural
  // --- Israel: standard wine-region names over mixed English/Hebrew ---
  'Golan':                 'Golan Heights',
  'Judea':                 'Judean Hills',
  'Shomron':               'Samaria',
};

// Nominatim resolved "Alsace, France" to a hamlet near Roubaix -- 412km off. Deleting the
// key would just re-geocode to the same wrong place, so the correct value is set directly.
const COORD_FIXES = {
  'France||Alsace': { lat: 48.3, lon: 7.5 },
};

// Trailing spaces made "Austria " and "New Zealand " distinct countries: separate filter
// entries, separate map markers, and no world-map match. drinks.js now trims on write;
// this cleans up what was stored before that.
const TRIM_CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const TRIM_FIELDS = ['country', 'region'];

// Blank cellar row: no producer, no name, no lots. Confirmed junk.
const DELETE_IDS = { wine: ['c405d698-54ea-4180-accf-f8d6e3a790ee'] };

function flatten(node, prefix = []) {
  const join = name => [...prefix, name].join(SEP);
  if (Array.isArray(node)) return node.map(join);
  return Object.entries(node).flatMap(([name, child]) => [join(name), ...flatten(child, [...prefix, name])]);
}

// A flat region is "placeable" when exactly one path in its country ends with it.
// Ambiguity is reported, never guessed.
function proposePath(country, region) {
  const matches = flatten(WINE_REGIONS[country] ?? {})
    .filter(p => p.includes(SEP) && p.split(SEP).pop() === region);
  return matches.length === 1 ? matches[0] : null;
}

// Three outcomes, so the review list stays short:
//   'nest'    -> a sub-region stored flat; propose the full path
//   'ok'      -> already valid (a real top-level region, or a country we can't check)
//   'unknown' -> in no taxonomy at all: a typo, or a region worth adding to the file
function classify(country, region) {
  const known = flatten(WINE_REGIONS[country] ?? {});
  if (!known.length) return { kind: 'ok' };
  if (known.includes(region)) return { kind: 'ok' };
  const proposed = proposePath(country, region);
  return proposed ? { kind: 'nest', proposed } : { kind: 'unknown' };
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(flatten({ A: ['B', 'C'] }), ['A', 'A / B', 'A / C']);
  assert.deepStrictEqual(flatten({ A: { B: ['C'] } }), ['A', 'A / B', 'A / B / C']);
  assert.deepStrictEqual(flatten({ A: [] }), ['A']);
  assert.strictEqual(proposePath('Italy', 'Chianti'), 'Toscana / Chianti');
  assert.strictEqual(proposePath('Italy', 'Chianti Classico'), 'Toscana / Chianti Classico');
  assert.strictEqual(classify('Italy', 'Chianti').kind, 'nest');
  assert.strictEqual(classify('Italy', 'Toscana').kind, 'ok');                // real top-level
  assert.strictEqual(classify('Italy', 'Tuscany').kind, 'unknown');           // English name
  assert.strictEqual(classify('New Zealand', 'Malborough').kind, 'unknown');  // typo
  assert.strictEqual(classify('Scotland', 'Speyside').kind, 'ok');            // not our taxonomy
  // re-running must be a no-op: an already-rewritten value is not a key
  assert.strictEqual(REWRITES['Toscana / Chianti'], undefined);
  assert.strictEqual(REWRITES['Marlborough'], undefined);
  assert.strictEqual(REWRITES['Judean Hills'], undefined);
  // every rewrite target must itself be a valid path in the taxonomy, or the migration
  // would write values the admin form then flags as off-list
  for (const target of Object.values(REWRITES)) {
    if (target === 'Islands') continue; // whiskey; Scotland is not in the wine taxonomy
    const inSome = Object.values(WINE_REGIONS).some(c => flatten(c).includes(target));
    assert.ok(inSome, `rewrite target not in taxonomy: ${target}`);
  }
  // the Porto decision: nested under Douro, not renamed away
  assert.strictEqual(REWRITES['Porto'], 'Douro / Porto');
  assert.ok(flatten(WINE_REGIONS.Portugal).includes('Douro / Porto'));
  assert.ok(flatten(WINE_REGIONS.Israel).includes('Judean Hills'));
}

async function collectFlatRegions() {
  const seen = new Map();
  for (const category of CATEGORIES) {
    for (const d of await readData(category)) {
      if (!d.region || d.region.includes(SEP)) continue;
      const key = `${d.country}||${d.region}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return seen;
}

async function dryRun() {
  const buckets = { willWrite: [], suggested: [], unknown: [], ok: [] };
  for (const [key, count] of [...(await collectFlatRegions()).entries()].sort()) {
    const [country, region] = key.split('||');
    // An explicit REWRITES line always wins -- that's the reviewed decision.
    if (REWRITES[region]) {
      buckets.willWrite.push({ country, region, count, target: REWRITES[region] });
      continue;
    }
    const result = classify(country, region);
    if (result.kind === 'nest') buckets.suggested.push({ country, region, count, target: result.proposed });
    else buckets[result.kind].push({ country, region, count });
  }

  console.log('\n=== 1. WILL BE WRITTEN - every one of these changes the DB ===');
  if (!buckets.willWrite.length) console.log('  (none)');
  buckets.willWrite.forEach(({ country, region, target, count }) => {
    console.log(`  ${country.padEnd(12)} "${region}" -> "${target}"  (${count} drinks)`);
  });

  console.log('\n=== 2. SUGGESTED but NOT in REWRITES - will NOT be written ===');
  if (!buckets.suggested.length) console.log('  (none)');
  buckets.suggested.forEach(({ country, region, target, count }) => {
    console.log(`  ${country.padEnd(12)} "${region}" -> "${target}"?  (${count} drinks)`);
  });

  console.log('\n=== 3. UNKNOWN - in no taxonomy (typo, or worth adding?) ===');
  if (!buckets.unknown.length) console.log('  (none)');
  buckets.unknown.forEach(({ country, region, count }) => {
    console.log(`  ${country.padEnd(12)} "${region}"  (${count} drinks)`);
  });

  console.log('\n=== 4. LEAVING ALONE (valid already, or country not in taxonomy) ===');
  console.log('  ' + (buckets.ok.map(b => `${b.country}/${b.region}`).join(', ') || '(none)'));

  const live = new Set(buckets.willWrite.map(b => b.region));
  const stale = Object.keys(REWRITES).filter(r => !live.has(r));
  if (stale.length) console.log('\n=== 5. IN REWRITES BUT UNUSED LIVE (stale lines) ===\n  ' + stale.join(', '));

  const coords = await db.getRegionCoordinatesCollection();
  const allCoords = await coords.find({}).toArray();
  console.log('\n=== 6. MAP PINS THAT WILL MOVE ===');
  const moving = allCoords.filter(d => REWRITES[d._id.split('||')[1]]);
  if (!moving.length) console.log('  (none)');
  moving.forEach(d => {
    const [country, region] = d._id.split('||');
    const collides = allCoords.some(o => o._id === `${country}||${REWRITES[region]}`);
    console.log(`  "${d._id}" -> "${country}||${REWRITES[region]}"${collides ? '  (target exists; old key dropped)' : ''}`);
  });

  console.log('\n=== 7. COORDINATES THAT WILL BE CORRECTED ===');
  const fixes = Object.entries(COORD_FIXES).filter(([id]) => allCoords.some(d => d._id === id));
  if (!fixes.length) console.log('  (none)');
  fixes.forEach(([id, { lat, lon }]) => {
    const cur = allCoords.find(d => d._id === id);
    console.log(`  "${id}"  ${cur.lat}, ${cur.lon}  ->  ${lat}, ${lon}`);
  });

  console.log('\n=== 8. WHITESPACE TO TRIM ===');
  let anyTrim = false;
  for (const category of TRIM_CATEGORIES) {
    for (const d of await readData(category)) {
      for (const f of TRIM_FIELDS) {
        const v = d[f];
        if (typeof v === 'string' && v !== v.trim() && v.trim() !== '') {
          console.log(`  ${category}: ${f} ${JSON.stringify(v)} -> ${JSON.stringify(v.trim())}`);
          anyTrim = true;
        }
      }
    }
  }
  if (!anyTrim) console.log('  (none)');

  console.log('\n=== 9. ROWS TO DELETE ===');
  let anyDelete = false;
  for (const [category, ids] of Object.entries(DELETE_IDS)) {
    for (const d of await readData(category)) {
      if (!ids.includes(d.id)) continue;
      anyDelete = true;
      const label = [d.producer, d.seriesAndName].filter(Boolean).join(' ') || '(entirely blank)';
      console.log(`  ${category}: ${d.id}  ${label}  lots=${(d.collection || []).length}`);
    }
  }
  if (!anyDelete) console.log('  (none)');

  console.log('\nNo changes written.\n');
}

async function migrate() {
  let changed = 0;
  for (const category of CATEGORIES) {
    const drinks = await readData(category);
    let touched = 0;
    for (const d of drinks) {
      const rewritten = REWRITES[d.region];
      if (!rewritten) continue;
      d.region = rewritten;
      touched++;
    }
    if (touched) await writeData(category, drinks);
    console.log(`${category}: ${touched}/${drinks.length} regions rewritten`);
    changed += touched;
  }

  // Same physical place, new key -- reuse the cached lat/lon instead of re-geocoding.
  const coords = await db.getRegionCoordinatesCollection();
  let moved = 0;
  for (const doc of await coords.find({}).toArray()) {
    const [country, region] = doc._id.split('||');
    const rewritten = REWRITES[region];
    if (!rewritten) continue;
    const newId = `${country}||${rewritten}`;
    const existing = await coords.find({ _id: newId }).toArray();
    if (!existing.length) await coords.insertMany([{ _id: newId, lat: doc.lat, lon: doc.lon }]);
    await coords.deleteMany({ _id: doc._id });
    moved++;
  }
  console.log(`regionCoordinates: ${moved} keys moved`);

  let fixed = 0;
  for (const [_id, { lat, lon }] of Object.entries(COORD_FIXES)) {
    const existing = await coords.find({ _id }).toArray();
    if (!existing.length) continue;
    await coords.deleteMany({ _id });
    await coords.insertMany([{ _id, lat, lon }]);
    fixed++;
  }
  console.log(`regionCoordinates: ${fixed} coordinates corrected`);

  for (const category of TRIM_CATEGORIES) {
    const drinks = await readData(category);
    let trimmed = 0;
    for (const d of drinks) {
      for (const f of TRIM_FIELDS) {
        if (typeof d[f] === 'string' && d[f] !== d[f].trim()) { d[f] = d[f].trim(); trimmed++; }
      }
    }
    const ids = DELETE_IDS[category] ?? [];
    const kept = ids.length ? drinks.filter(d => !ids.includes(d.id)) : drinks;
    const deleted = drinks.length - kept.length;
    if (trimmed || deleted) await writeData(category, kept);
    if (trimmed || deleted) console.log(`${category}: ${trimmed} fields trimmed, ${deleted} rows deleted`);
  }
  return changed;
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  if (process.argv.includes('--dry-run')) { await dryRun(); await db.close(); return; }

  // Writing to live data is opt-in twice: the dry run has to have been read, and the
  // caller has to say so explicitly. Prevents a stray re-run from rewriting the DB.
  if (!process.argv.includes('--i-reviewed-the-dry-run')) {
    console.error('Refusing to write. Run with --dry-run first, then re-run with --i-reviewed-the-dry-run.');
    process.exit(1);
  }
  await migrate();
  await db.close();
}

selfTest();
main().catch(e => { console.error(e.message); process.exit(1); });
