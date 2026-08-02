// One-time migration: fix known wine.variety typos ("Cabernet France" -> "Cabernet Franc",
// "Cabernet Saugvinon" -> "Cabernet Sauvignon") and dedupe the resulting array.
// Run manually, once: node --env-file-if-exists=.env server/scripts/fix-variety-typos.js
// Requires MONGODB_URI to already be set in the environment.
const { readData, writeData } = require('../dataStore');
const { close } = require('../db');

const RENAME_MAP = {
  'Cabernet France': 'Cabernet Franc',
  'Cabernet Saugvinon': 'Cabernet Sauvignon',
};

function fixVariety(variety) {
  return [...new Set((variety || []).map(v => RENAME_MAP[v] || v))];
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(fixVariety(['Cabernet France', 'Merlot']), ['Cabernet Franc', 'Merlot']);
  assert.deepStrictEqual(fixVariety(['Cabernet Saugvinon', 'Cabernet Sauvignon']), ['Cabernet Sauvignon']);
  assert.deepStrictEqual(fixVariety(['Cabernet Franc']), ['Cabernet Franc']);
  assert.deepStrictEqual(fixVariety([]), []);
  assert.deepStrictEqual(fixVariety(undefined), []);
}

async function migrate() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }

  const wines = await readData('wine');
  let changed = 0;
  for (const wine of wines) {
    const fixed = fixVariety(wine.variety);
    if (JSON.stringify(fixed) !== JSON.stringify(wine.variety || [])) {
      wine.variety = fixed;
      changed++;
    }
  }
  await writeData('wine', wines);
  console.log(`wine: ${changed}/${wines.length} entries fixed`);
  await close();
}

selfTest();
migrate().catch(e => { console.error(e.message); process.exit(1); });
