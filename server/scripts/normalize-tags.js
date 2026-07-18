// One-time migration: trim + lowercase drink.tags and dedupe, fixing case-variant
// duplicates (e.g. "gift" / "Gift") left over from before tags were normalized on write.
// Run manually, once: node server/scripts/normalize-tags.js
// Requires MONGODB_URI to already be set in the environment.
const { readData, writeData } = require('../dataStore');
const { close } = require('../db');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

function normalizeTags(tags) {
  return [...new Set((tags || []).map(t => t.trim().toLowerCase()).filter(Boolean))];
}

function selfTest() {
  const assert = require('assert');
  assert.deepStrictEqual(normalizeTags(['Gift', 'gift', ' gift ']), ['gift']);
  assert.deepStrictEqual(normalizeTags(['Cellar', 'organic']), ['cellar', 'organic']);
  assert.deepStrictEqual(normalizeTags([]), []);
  assert.deepStrictEqual(normalizeTags(undefined), []);
}

async function migrate() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }

  for (const category of CATEGORIES) {
    const drinks = await readData(category);
    let changed = 0;
    for (const drink of drinks) {
      const normalized = normalizeTags(drink.tags);
      if (JSON.stringify(normalized) !== JSON.stringify(drink.tags || [])) {
        drink.tags = normalized;
        changed++;
      }
    }
    await writeData(category, drinks);
    console.log(`${category}: ${changed}/${drinks.length} entries normalized`);
  }
  await close();
}

selfTest();
migrate().catch(e => { console.error(e.message); process.exit(1); });
