const db = require('./db');

async function readData(category) {
  try {
    const col = await db.getCollection(category);
    return await col.find({}, { projection: { _id: 0 } }).toArray();
  } catch {
    throw new Error(`Failed to read data for category: ${category}`);
  }
}

async function writeData(category, data) {
  const col = await db.getCollection(category);
  await col.deleteMany({});
  if (data.length) await col.insertMany(data);
}

module.exports = { readData, writeData };
