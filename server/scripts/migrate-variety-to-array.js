// One-time migration: convert wine.variety from a free-text string to a string[].
// Run manually, once: node server/scripts/migrate-variety-to-array.js
// Requires MONGODB_URI to already be set in the environment.
const { readData, writeData } = require('../dataStore');
const { close } = require('../db');

function splitVariety(variety) {
  if (!variety) return [];
  if (Array.isArray(variety)) return variety;
  return variety
    .split(/\s*[/,]\s*|\s+and\s+|\s+&\s+/i)
    .map(v => v.trim())
    .filter(Boolean);
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(splitVariety('Cabernet Sauvignon'), ['Cabernet Sauvignon']);
  assert.deepStrictEqual(splitVariety('Merlot, Cabernet Sauvignon'), ['Merlot', 'Cabernet Sauvignon']);
  assert.deepStrictEqual(splitVariety('Grenache/Syrah/Mourvedre'), ['Grenache', 'Syrah', 'Mourvedre']);
  assert.deepStrictEqual(splitVariety('Sangiovese and Merlot'), ['Sangiovese', 'Merlot']);
  assert.deepStrictEqual(splitVariety(''), []);
  assert.deepStrictEqual(splitVariety(['already', 'array']), ['already', 'array']);
}

async function migrate() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }

  const wines = await readData('wine');
  let changed = 0;
  for (const drink of wines) {
    if (typeof drink.variety === 'string') {
      drink.variety = splitVariety(drink.variety);
      changed++;
    }
  }

  await writeData('wine', wines);
  console.log(`wine: ${changed}/${wines.length} variety fields converted to arrays`);
  await close();
}

selfTest();
migrate().catch(e => { console.error(e.message); process.exit(1); });
