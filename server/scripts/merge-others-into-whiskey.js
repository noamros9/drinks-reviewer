// One-time migration: merge the 'others' collection into 'whiskeys' (Atlas Search index cap
// of 3 per cluster forced sharing a physical collection). Tags every doc with _category so
// db.js's scoped wrapper can keep the two logically separate. Renames 'others' to
// 'others_archived_<timestamp>' afterward rather than dropping it, so it's recoverable.
// Run manually, once: node server/scripts/merge-others-into-whiskey.js
// Requires MONGODB_URI (and MONGODB_DB) already set in the environment.
const { MongoClient } = require('mongodb');

async function migrate() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);

  const whiskeys = db.collection('whiskeys');
  const others = db.collection('others');

  const backfill = await whiskeys.updateMany({ _category: { $exists: false } }, { $set: { _category: 'whiskey' } });
  console.log(`Backfilled _category on ${backfill.modifiedCount} existing whiskey docs.`);

  const othersDocs = await others.find({}).toArray();
  const tagged = othersDocs.map(({ _id, ...rest }) => ({ ...rest, _category: 'others' }));
  if (tagged.length) await whiskeys.insertMany(tagged);
  console.log(`Copied ${tagged.length} others docs into whiskeys.`);

  if (othersDocs.length) {
    await others.rename(`others_archived_${Date.now()}`);
    console.log('Renamed old others collection for archival.');
  }

  await client.close();
}

migrate().catch(err => { console.error(err); process.exit(1); });
