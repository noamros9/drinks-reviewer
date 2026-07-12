const { MongoClient } = require('mongodb');

// 'others' shares the physical 'whiskeys' collection/Search index (Atlas free tier caps
// Search indexes at 3/cluster) — SHARED_CATEGORY_TAG + scopeByCategory() below keep the two
// logically separate via a `_category` discriminator field. See server/scripts/merge-others-into-whiskey.js.
const COLLECTIONS = { wine: 'wines', beer: 'beers', whiskey: 'whiskeys', others: 'whiskeys' };
const SHARED_CATEGORY_TAG = { whiskey: 'whiskey', others: 'others' };

let client = null;
let db = null;
let fake = null;

// Whole-collection in-memory fake, used whenever MONGODB_URI is unset (tests, and any
// environment that hasn't been given real credentials). Mirrors the tiny slice of the
// MongoDB driver's API dataStore.js/search.js actually call: find().toArray(), deleteMany,
// insertMany, aggregate().toArray().
// ponytail: fakeAggregate is a best-effort approximation of $search.text (substring match)
// plus a plain $match equality filter (for scopeByCategory's _category injection) — not a
// real aggregation engine, only understands the stages this codebase actually emits.
function fakeAggregate(docs, pipeline) {
  let result = docs.map(d => ({ ...d }));
  for (const stage of pipeline) {
    if (stage.$search?.text) {
      const { query, path } = stage.$search.text;
      const q = query.toLowerCase();
      const fields = Array.isArray(path) ? path : [path];
      result = result.filter(d => fields.some(f => String(d[f] ?? '').toLowerCase().includes(q)));
    } else if (stage.$match) {
      result = result.filter(d => Object.entries(stage.$match).every(([k, v]) => d[k] === v));
    }
  }
  return result;
}

function matchesFilter(doc, filter) {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

function fakeCollection(name) {
  if (!fake.has(name)) fake.set(name, []);
  const docs = () => fake.get(name);
  return {
    find: (filter = {}) => ({ toArray: async () => docs().filter(d => matchesFilter(d, filter)).map(d => ({ ...d })) }),
    deleteMany: async (filter = {}) => { fake.set(name, docs().filter(d => !matchesFilter(d, filter))); },
    insertMany: async (newDocs) => { docs().push(...newDocs.map(d => ({ ...d }))); },
    aggregate: (pipeline) => ({ toArray: async () => fakeAggregate(docs(), pipeline) }),
  };
}

// Wraps a raw collection so every op is transparently scoped to `tag` via a `_category`
// field, letting 'whiskey' and 'others' share one physical collection/Search index without
// dataStore.js/search.js/routes needing to know.
function scopeByCategory(raw, tag) {
  return {
    find: (filter = {}, opts) => raw.find({ ...filter, _category: tag }, opts),
    deleteMany: (filter = {}) => raw.deleteMany({ ...filter, _category: tag }),
    insertMany: (docs) => raw.insertMany(docs.map(d => ({ ...d, _category: tag }))),
    aggregate: (pipeline) => {
      const idx = pipeline.findIndex(s => s.$search);
      const withMatch = idx >= 0
        ? [...pipeline.slice(0, idx + 1), { $match: { _category: tag } }, ...pipeline.slice(idx + 1)]
        : [{ $match: { _category: tag } }, ...pipeline];
      return raw.aggregate(withMatch);
    },
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
  const raw = realDb
    ? realDb.collection(name)
    : (() => { if (!fake) fake = new Map(); return fakeCollection(name); })();
  const tag = SHARED_CATEGORY_TAG[category];
  return tag ? scopeByCategory(raw, tag) : raw;
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
