// One-time migration: load the existing local JSON category files into MongoDB Atlas.
// Run manually, once, against a fresh cluster: node server/scripts/migrate-to-atlas.js
// Requires MONGODB_URI (and MONGODB_DB) to already be set in the environment.
const fs = require('fs');
const path = require('path');
const { getCollection, getRegionCoordinatesCollection, close } = require('../db');

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

  const coordsPath = path.join(DATA_DIR, 'region-coordinates.json');
  if (fs.existsSync(coordsPath)) {
    const coords = JSON.parse(fs.readFileSync(coordsPath, 'utf8'));
    const docs = Object.entries(coords).map(([key, { lat, lon }]) => ({ _id: key, lat, lon }));
    const col = await getRegionCoordinatesCollection();
    const existingIds = new Set((await col.find({}).toArray()).map(d => d._id));
    const newDocs = docs.filter(d => !existingIds.has(d._id));
    if (newDocs.length) await col.insertMany(newDocs);
    console.log(`Migrated ${newDocs.length} region-coordinates entries.`);
  }

  await close();
}

migrate().catch(err => { console.error(err); process.exit(1); });
