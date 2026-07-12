const { MongoClient } = require('mongodb');

const COLLECTIONS = { wine: 'wines', beer: 'beers', whiskey: 'whiskeys', others: 'others' };

let client = null;
let db = null;
let fake = null;

// Whole-collection in-memory fake, used whenever MONGODB_URI is unset (tests, and any
// environment that hasn't been given real credentials). Mirrors the tiny slice of the
// MongoDB driver's API dataStore.js actually calls: find().toArray(), deleteMany, insertMany.
function fakeCollection(name) {
  if (!fake.has(name)) fake.set(name, []);
  const docs = () => fake.get(name);
  return {
    find: () => ({ toArray: async () => docs().map(d => ({ ...d })) }),
    deleteMany: async () => { fake.set(name, []); },
    insertMany: async (newDocs) => { docs().push(...newDocs.map(d => ({ ...d }))); },
  };
}

async function connect() {
  if (!process.env.MONGODB_URI) return null;
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db(process.env.MONGODB_DB);
  }
  return db;
}

async function getCollection(category) {
  const name = COLLECTIONS[category];
  const realDb = await connect();
  if (!realDb) {
    if (!fake) fake = new Map();
    return fakeCollection(name);
  }
  return realDb.collection(name);
}

function resetFake() {
  fake = new Map();
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { getCollection, COLLECTIONS, close, resetFake };
