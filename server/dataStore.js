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
  await db.withTransaction(async session => {
    const col = await db.getCollection(category);
    await col.deleteMany({}, { session });
    if (data.length) await col.insertMany(data, { session });
  });
}

module.exports = { readData, writeData };
