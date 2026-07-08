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

function buildPrompt(seedDrinks, candidatePool) {
  return `You are a drinks recommendation assistant for a personal wine/beer/whiskey/spirits journal app.

The user picked these drinks as the basis for a recommendation:
${JSON.stringify(seedDrinks, null, 2)}

Here is the user's full catalogue, to check for "already own" matches (do not recommend the seed drinks themselves):
${JSON.stringify(candidatePool, null, 2)}

Recommend similar drinks in three groups:
1. "ownCatalogue": up to 3 drinks from the catalogue above (excluding the seeds) that are genuinely similar. Reference each by its exact "id" and "category" from the list above.
2. "availableInIsrael": real-world drinks NOT in the catalogue, similar to the seeds, that can be purchased in Israel. Use web search to find one real, working purchase link per entry — omit an entry if you cannot find an actual link, never invent one.
3. "notAvailable": real-world drinks NOT in the catalogue, similar to the seeds, that are not readily available for purchase in Israel.
Groups 2 and 3 combined should have roughly 3-6 entries, as many as make sense.

Respond with ONLY a single fenced JSON code block at the very end of your reply, matching exactly this shape:
\`\`\`json
{
  "ownCatalogue": [{"id": "...", "category": "...", "reason": "..."}],
  "availableInIsrael": [{"name": "...", "description": "...", "url": "...", "reason": "..."}],
  "notAvailable": [{"name": "...", "description": "...", "reason": "..."}]
}
\`\`\``;
}

function parseResponse(body) {
  const text = (body.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!match) throw new RecommendError('No JSON found in Claude response', 502);
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new RecommendError('Failed to parse JSON from Claude response', 502);
  }
}

function validate(parsed, catalogueByCategory) {
  const ownCatalogue = (parsed.ownCatalogue || [])
    .filter(e => (catalogueByCategory[e.category] || []).some(d => d.id === e.id))
    .slice(0, 3)
    .map(e => ({ id: e.id, category: e.category, label: label(catalogueByCategory[e.category].find(d => d.id === e.id)), reason: e.reason || '' }));

  const availableInIsrael = (parsed.availableInIsrael || [])
    .filter(e => typeof e.url === 'string' && e.url.trim())
    .slice(0, 8);
  const notAvailable = (parsed.notAvailable || []).slice(0, Math.max(0, 8 - availableInIsrael.length));

  return { ownCatalogue, availableInIsrael, notAvailable };
}

// ponytail: single-turn web_search with a low max_uses avoids the pause_turn
// multi-turn continuation case (long-running searches) rather than handling it;
// add continuation handling if pause_turn is observed in practice.
async function getRecommendations(seeds) {
  if (!process.env.ANTHROPIC_API_KEY) throw new RecommendError('ANTHROPIC_API_KEY is not set', 500);

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(seedDrinks, candidatePool) }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', country: 'IL' } }],
    }),
  });

  if (!res.ok) throw new RecommendError(`Anthropic API error: ${res.status}`, 502);
  const body = await res.json();
  return validate(parseResponse(body), catalogueByCategory);
}

module.exports = { getRecommendations };
