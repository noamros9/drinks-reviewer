// Repairs the region-coordinates collection that feeds the world map's region markers.
//
// Two problems it fixes:
//   1. ensureRegionCoordinates only ever runs on a drink save, so regions created by the
//      region-nesting scripts were never geocoded — 13 of 41 had no marker at all. It also
//      only ever sees a *drink's* region string, so a parent path like "Italy||Puglia" that
//      no drink names directly is never geocoded, leaving the map's rolled-up parent dot
//      with no position of its own. Ancestor paths are walked here for that reason.
//   2. Entries geocoded before the country check existed can point at the wrong continent
//      ("Judea, Israel" -> a street in Santiago, Chile). Those are re-verified and dropped.
//
//   node --env-file-if-exists=.env server/scripts/backfill-region-coordinates.js --dry-run
//   node --env-file-if-exists=.env server/scripts/backfill-region-coordinates.js --i-reviewed-the-dry-run
//
// Requires MONGODB_URI. Writes a JSON dump of the collection next to the repo before
// deleting anything — backup-data.js did not cover regionCoordinates until this change.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { readData } = require('../dataStore');
const { geocodeRegion, coordinateIsInCountry, countryCode } = require('../geocoding');

const REGION_CATEGORIES = ['wine', 'whiskey'];
const SEP = ' / ';
const NOMINATIM_DELAY_MS = 1100; // usage policy: max 1 request/second

const sleep = ms => new Promise(r => setTimeout(r, ms));

// "A / B / C" -> ["A", "A / B", "A / B / C"]. Mirrors regionAncestors in
// client/src/utils/filterHelpers.js.
const ancestors = region => region.split(SEP).map((_, i, parts) => parts.slice(0, i + 1).join(SEP));

// Every country||region path the map could want a marker for, parents included.
async function wantedKeys() {
  const keys = new Set();
  for (const category of REGION_CATEGORIES) {
    for (const drink of await readData(category)) {
      if (!drink.country || !drink.region) continue;
      for (const path of ancestors(drink.region)) keys.add(`${drink.country}||${path}`);
    }
  }
  return [...keys].sort();
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(ancestors('Toscana'), ['Toscana']);
  assert.deepStrictEqual(ancestors('Veneto / Valpolicella / Ripasso'),
    ['Veneto', 'Veneto / Valpolicella', 'Veneto / Valpolicella / Ripasso']);
  assert.strictEqual(countryCode('Scotland'), 'gb');
  assert.strictEqual(countryCode('Israel'), 'il');
}

async function run({ write }) {
  const collection = await db.getRegionCoordinatesCollection();
  const stored = Object.fromEntries((await collection.find({}).toArray()).map(d => [d._id, { lat: d.lat, lon: d.lon }]));
  const keys = await wantedKeys();

  if (write) {
    const dump = path.join(__dirname, `../../region-coordinates-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(dump, JSON.stringify(stored, null, 2));
    console.log(`Dumped ${Object.keys(stored).length} existing entries to ${path.basename(dump)}`);
  }

  const missing = keys.filter(k => !stored[k]);
  const present = keys.filter(k => stored[k]);
  const orphaned = Object.keys(stored).filter(k => !keys.includes(k));

  console.log(`\n${keys.length} region paths wanted; ${present.length} stored, ${missing.length} missing, ${orphaned.length} stored but unused.`);

  const toAdd = [];
  const toFix = [];
  const toDrop = [];

  for (const key of missing) {
    const [country, region] = key.split('||');
    const found = await geocodeRegion(country, region).catch(() => null);
    console.log(found ? `  ADD    ${key}  ->  ${found.lat.toFixed(3)}, ${found.lon.toFixed(3)}` : `  NONE   ${key}  (no verified match)`);
    if (found) toAdd.push({ _id: key, ...found });
    await sleep(NOMINATIM_DELAY_MS);
  }

  // Verify what's on file by asking what is actually AT each point. Re-running the forward
  // search and comparing distance would be worse than useless here: "Alsace, France"
  // resolves to a street in Lille, and that check would overwrite a correct coordinate with
  // it. Only the reverse lookup separates "wrong country" from "slightly imprecise".
  for (const key of present) {
    const [country, region] = key.split('||');
    const ok = await coordinateIsInCountry(country, stored[key]).catch(() => true);
    await sleep(NOMINATIM_DELAY_MS);
    if (ok) continue;

    const replacement = await geocodeRegion(country, region).catch(() => null);
    await sleep(NOMINATIM_DELAY_MS);
    if (replacement) {
      console.log(`  FIX    ${key}  ${stored[key].lat.toFixed(2)}, ${stored[key].lon.toFixed(2)}  ->  ${replacement.lat.toFixed(3)}, ${replacement.lon.toFixed(3)}`);
      toFix.push({ _id: key, ...replacement });
    } else {
      // No marker beats a marker on the wrong continent.
      console.log(`  DROP   ${key}  ${stored[key].lat.toFixed(2)}, ${stored[key].lon.toFixed(2)}  (outside ${country}, no replacement)`);
      toDrop.push(key);
    }
  }

  console.log(`\n${toAdd.length} to add, ${toFix.length} to correct, ${toDrop.length} to drop.`);
  if (!write) { console.log('No changes written.\n'); return; }

  const changed = [...toAdd, ...toFix];
  const removing = [...changed.map(d => d._id), ...toDrop];
  if (removing.length) await collection.deleteMany({ _id: { $in: removing } });
  if (changed.length) await collection.insertMany(changed);
  console.log(`Written: ${changed.length} added/corrected, ${toDrop.length} dropped.`);
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
