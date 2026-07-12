// One-time migration: load the existing local JSON category files into MongoDB Atlas.
// Run manually, once, against a fresh cluster: node server/scripts/migrate-to-atlas.js
// Requires MONGODB_URI (and MONGODB_DB) to already be set in the environment.
const fs = require('fs');
const path = require('path');
const { getCollection, close } = require('../db');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const DATA_DIR = path.join(__dirname, '../data');

async function migrate() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }
  for (const category of CATEGORIES) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${category}.json`), 'utf8'));
    const col = await getCollection(category);
    if (data.length) await col.insertMany(data);
    console.log(`Migrated ${data.length} ${category} entries.`);
  }
  await close();
}

migrate().catch(err => { console.error(err); process.exit(1); });
