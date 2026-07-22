const { readData } = require('./dataStore');

const NAME_FIELDS = {
  wine: ['producer', 'seriesAndName'],
  beer: ['brewery', 'name'],
  whiskey: ['distillery', 'name'],
  others: ['distillery', 'name'],
};

function curateDrink(drink, category) {
  const [producerKey, nameKey] = NAME_FIELDS[category];
  return {
    id: drink.id,
    category,
    producer: drink[producerKey],
    name: drink[nameKey],
    avgRating: drink.avgRating ?? null,
    tastingCount: drink.tastingCount ?? 0,
    tastings: (drink.tastings || []).map(t => ({ date: t.date, rating: t.rating, imageUrl: t.imageUrl ?? null })),
    photo: drink.collectionImageUrl ?? drink.tastings?.at(-1)?.imageUrl ?? null,
  };
}

async function getPublicCatalog(categories) {
  const out = [];
  for (const category of categories) {
    (await readData(category)).filter(d => !d.collectionOnly).forEach(d => out.push(curateDrink(d, category)));
  }
  return out;
}

async function getPublicDrink(category, id, categories) {
  if (!categories.includes(category)) return null;
  const drink = (await readData(category)).find(d => d.id === id);
  return drink?.shared ? curateDrink(drink, category) : null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildShareHtml(template, drink) {
  if (!drink) return template;
  const title = `${drink.producer} — ${drink.name}`;
  const description = drink.avgRating != null ? `Rated ${drink.avgRating}/10` : 'Not yet tasted';
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    ...(drink.photo ? [`<meta property="og:image" content="${escapeHtml(drink.photo)}">`] : []),
  ].join('\n');
  return template.replace('</head>', `${tags}\n</head>`);
}

module.exports = { curateDrink, getPublicCatalog, getPublicDrink, buildShareHtml };
