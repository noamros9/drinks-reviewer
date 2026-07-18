const db = require('./db');

// Kept in sync with PRODUCER_FIELD + NAME_FIELD in client/src/utils/filterHelpers.js
const SEARCH_FIELDS = {
  wine: ['producer', 'seriesAndName'],
  beer: ['brewery', 'name'],
  whiskey: ['distillery', 'name'],
  others: ['distillery', 'name'],
};

// Atlas Search wildcard() treats * and ? as glob operators; escape them so a
// literal "*" typed by a user is matched literally rather than as a wildcard.
function escapeWildcard(str) {
  return str.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/\?/g, '\\?');
}

async function searchCategory(category, q) {
  const col = await db.getCollection(category);
  const query = `*${escapeWildcard(q.toLowerCase())}*`;
  const docs = await col.aggregate([
    { $search: { wildcard: { query, path: SEARCH_FIELDS[category], allowAnalyzedField: true } } },
    { $project: { _id: 0 } },
  ]).toArray();
  return docs.filter(d => !d.collectionOnly);
}

module.exports = { searchCategory, SEARCH_FIELDS };
