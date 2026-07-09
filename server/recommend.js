const { readData } = require('./dataStore');

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

const SIMILARITY_FIELDS = {
  wine: ['producer', 'seriesAndName', 'wineCategory', 'variety', 'sweetness', 'country', 'region', 'abv', 'tags'],
  beer: ['brewery', 'name', 'style', 'country', 'abv', 'tags'],
  whiskey: ['distillery', 'name', 'country', 'region', 'age', 'style', 'abv', 'tags'],
  others: ['drinkCategory', 'distillery', 'name', 'country', 'style', 'age', 'abv', 'tags'],
};

class RecommendError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function label(drink) {
  const producer = drink.producer ?? drink.brewery ?? drink.distillery ?? '';
  const name = drink.seriesAndName || drink.name || '';
  return [producer, name].filter(Boolean).join(' ') || 'Unknown';
}

function trim(drink, category) {
  const picked = { id: drink.id, category, label: label(drink), avgRating: drink.avgRating };
  for (const field of SIMILARITY_FIELDS[category]) picked[field] = drink[field];
  return picked;
}

const NUMERIC_FIELDS = { abv: 1, age: 3 }; // ponytail: fixed tolerance per field, tune if scores feel off

function fieldScore(field, seedVal, candVal) {
  if (seedVal == null || candVal == null || seedVal === '' || candVal === '') return 0;
  if (field === 'tags') {
    const a = new Set(seedVal), b = new Set(candVal);
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return intersection / union;
  }
  if (field in NUMERIC_FIELDS) {
    const diff = Math.abs(parseFloat(seedVal) - parseFloat(candVal));
    if (Number.isNaN(diff)) return 0;
    return Math.max(0, 1 - diff / NUMERIC_FIELDS[field]);
  }
  return seedVal === candVal ? 1 : 0;
}

const FIELD_LABELS = {
  producer: 'producer', brewery: 'brewery', distillery: 'distillery',
  seriesAndName: 'name', name: 'name', variety: 'variety', wineCategory: 'category',
  drinkCategory: 'category', sweetness: 'sweetness', style: 'style',
  country: 'country', region: 'region', abv: 'ABV', age: 'age', tags: 'tags',
};

// ponytail: only scores candidates against seeds of the same category (cross-category
// field sets barely overlap) — add cross-category scoring if that's ever wanted.
function scoreAndReason(sameCategorySeeds, candidate) {
  const fields = SIMILARITY_FIELDS[candidate.category];
  let best = { score: 0, matchedFields: [] };
  for (const seed of sameCategorySeeds) {
    const perField = fields.map(f => ({ f, s: fieldScore(f, seed[f], candidate[f]) }));
    const score = perField.reduce((sum, x) => sum + x.s, 0);
    if (score > best.score) best = { score, matchedFields: perField.filter(x => x.s > 0).map(x => x.f) };
  }
  return best;
}

function scoreSimilarity(seedDrinks, candidate) {
  const sameCategorySeeds = seedDrinks.filter(s => s.category === candidate.category);
  return scoreAndReason(sameCategorySeeds, candidate).score;
}

function buildOwnCatalogue(seedDrinks, candidatePool) {
  const seedsByCategory = {};
  for (const seed of seedDrinks) (seedsByCategory[seed.category] ||= []).push(seed);

  return candidatePool
    .map(candidate => ({ candidate, ...scoreAndReason(seedsByCategory[candidate.category] || [], candidate) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ candidate, matchedFields }) => ({
      id: candidate.id,
      category: candidate.category,
      label: candidate.label,
      reason: `Similar ${matchedFields.map(f => FIELD_LABELS[f]).join(', ')}`, // matchedFields is always non-empty here: filter(score > 0) guarantees at least one field scored > 0; every SIMILARITY_FIELDS entry has a FIELD_LABELS mapping
    }));
}

function buildPrompt(seedDrinks) {
  return `You are a drinks recommendation assistant for a personal wine/beer/whiskey/spirits journal app.

The user picked these drinks as the basis for a recommendation:
${JSON.stringify(seedDrinks, null, 2)}

Find real-world drinks similar to the seeds above, in two groups:
1. "availableInIsrael": real-world drinks similar to the seeds that can be purchased in Israel. Use search to find one real, working purchase link per entry — omit an entry if you cannot find an actual link, never invent one.
2. "notAvailable": real-world drinks similar to the seeds that are not readily available for purchase in Israel.
Groups combined should have roughly 3-6 entries, as many as make sense.

Respond with ONLY a single fenced JSON code block at the very end of your reply, matching exactly this shape:
\`\`\`json
{
  "availableInIsrael": [{"name": "...", "description": "...", "url": "...", "reason": "..."}],
  "notAvailable": [{"name": "...", "description": "...", "reason": "..."}]
}
\`\`\``;
}

function parseResponse(body) {
  const text = (body.candidates || [])
    .flatMap(c => (c.content?.parts || []))
    .map(part => part.text)
    .filter(Boolean)
    .join('\n');
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!match) throw new RecommendError('No JSON found in Gemini response', 502);
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new RecommendError('Failed to parse JSON from Gemini response', 502);
  }
}

// ponytail: fuzzy substring match against known labels rather than a real dedupe/fuzzy-match
// library — good enough to catch "already own this" overlaps, revisit if false positives show up.
function alreadyInCatalogue(name, catalogueLabels) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return false;
  return catalogueLabels.some(label => {
    const l = label.trim().toLowerCase();
    return n.includes(l) || l.includes(n);
  });
}

function validate(parsed, catalogueLabels) {
  const availableInIsrael = (parsed.availableInIsrael || [])
    .filter(e => typeof e.url === 'string' && e.url.trim())
    .filter(e => !alreadyInCatalogue(e.name, catalogueLabels))
    .slice(0, 8);
  const notAvailable = (parsed.notAvailable || [])
    .filter(e => !alreadyInCatalogue(e.name, catalogueLabels))
    .slice(0, Math.max(0, 8 - availableInIsrael.length));

  return { availableInIsrael, notAvailable };
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ponytail: one retry on a transient 503 ("model overloaded") is Google's own recommended
// handling for this status; raise RETRIES if it's still flaky in practice.
const RETRIES = 1;

async function callGemini(seedDrinks) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(seedDrinks) }] }],
          tools: [{ google_search: {} }],
        }),
      }
    );
    if (res.ok) return res.json();
    if (res.status !== 503 || attempt === RETRIES) throw new RecommendError(`Gemini API error: ${res.status}`, 502);
    await sleep(1000);
  }
}

async function getRecommendations(seeds) {
  if (!process.env.GEMINI_API_KEY) throw new RecommendError('GEMINI_API_KEY is not set', 500);

  const catalogueByCategory = {};
  try {
    for (const category of CATEGORIES) catalogueByCategory[category] = readData(category);
  } catch (err) {
    throw new RecommendError(err.message, 500);
  }

  const seedDrinks = seeds.map(({ id, category }) => {
    const drink = (catalogueByCategory[category] || []).find(d => d.id === id);
    if (!drink) throw new RecommendError(`Seed drink not found: ${id}`, 400);
    return trim(drink, category);
  });

  const seedIds = new Set(seedDrinks.map(d => d.id));
  const candidatePool = CATEGORIES.flatMap(category =>
    catalogueByCategory[category].filter(d => !seedIds.has(d.id)).map(d => trim(d, category))
  );

  const ownCatalogue = buildOwnCatalogue(seedDrinks, candidatePool);
  const catalogueLabels = [...seedDrinks, ...candidatePool].map(d => d.label);
  const body = await callGemini(seedDrinks);
  const { availableInIsrael, notAvailable } = validate(parseResponse(body), catalogueLabels);
  return { ownCatalogue, availableInIsrael, notAvailable };
}

module.exports = { getRecommendations, scoreSimilarity };
