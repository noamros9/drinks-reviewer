// One-time migration: merge drink.collectionTags into drink.tags and drop collectionTags.
// Run manually, once: node server/scripts/migrate-collectiontags-into-tags.js
// Requires MONGODB_URI to already be set in the environment.
const { readData, writeData } = require('../dataStore');
const { close } = require('../db');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

async function migrate() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }

  for (const category of CATEGORIES) {
    const drinks = await readData(category);
    let changed = 0;
    for (const drink of drinks) {
      if ('collectionTags' in drink) {
        drink.tags = [...new Set([...(drink.tags || []), ...drink.collectionTags])];
        delete drink.collectionTags;
        changed++;
      }
    }
    await writeData(category, drinks);
    console.log(`${category}: ${changed}/${drinks.length} entries merged`);
  }
  await close();
}

migrate().catch(e => { console.error(e.message); process.exit(1); });
