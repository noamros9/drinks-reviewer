const db = require('./db');

async function getSettings() {
  const col = await db.getSettingsCollection();
  const [doc] = await col.find({ _id: 'global' }).toArray();
  return { catalogPublic: doc?.catalogPublic ?? false };
}

async function setCatalogPublic(value) {
  const col = await db.getSettingsCollection();
  await col.deleteMany({ _id: 'global' });
  await col.insertMany([{ _id: 'global', catalogPublic: !!value }]);
}

module.exports = { getSettings, setCatalogPublic };
