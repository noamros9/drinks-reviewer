const request = require('supertest');

let app;
let db;

const WINE = [
  { id: 'w1', producer: 'Domaine A', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light', 'earthy'], collection: [{ quantity: 2, price: 100 }] },
  { id: 'w2', producer: 'Domaine B', seriesAndName: 'Chardonnay', variety: 'Chardonnay', country: 'France', region: 'Chablis', abv: '12.5', tags: [], collection: [{ quantity: 0, price: 80 }] },
];
const BEER = [{ id: 'b1', brewery: 'Brew Co', name: 'IPA', style: 'IPA', country: 'USA', abv: '6', tags: [] }];

async function writeFixture({ wine = WINE, beer = BEER } = {}) {
  db.resetFake();
  const wineCol = await db.getCollection('wine');
  await wineCol.insertMany(wine);
  const beerCol = await db.getCollection('beer');
  await beerCol.insertMany(beer);
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(payload) + '\n```' }] } }],
    }),
  };
}

beforeEach(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  jest.resetModules();
  app = require('../index');
  db = require('../db');
  await writeFixture();
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete global.fetch;
  jest.resetModules();
});

describe('POST /api/generate-list', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/generate-list').send({});
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when prompt is blank', async () => {
    const res = await request(app).post('/api/generate-list').send({ prompt: '   ' });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await request(app).post('/api/generate-list').send({ prompt: 'something bold' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('returns 400 when the catalogue is entirely empty', async () => {
    await writeFixture({ wine: [], beer: [] });
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 500 when a catalogue collection cannot be read', async () => {
    const getCollectionSpy = jest.spyOn(db, 'getCollection').mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(500);
    getCollectionSpy.mockRestore();
  });

  it('returns 500 with a generic message on an unexpected error with no status (e.g. a network failure)', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Data unavailable');
  });

  it('splits ranked results into inCollection and elsewhereInCatalogue', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      results: [
        { id: 'w1', category: 'wine', reason: 'earthy and food-friendly' },
        { id: 'w2', category: 'wine', reason: 'out of stock but rated well' },
        { id: 'b1', category: 'beer', reason: 'hoppy and refreshing' },
      ],
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'something for a barbecue' });
    expect(res.status).toBe(200);
    expect(res.body.prompt).toBe('something for a barbecue');
    expect(res.body.inCollection).toEqual([
      { id: 'w1', category: 'wine', label: 'Domaine A Pinot Noir', avgRating: undefined, reason: 'earthy and food-friendly' },
    ]);
    expect(res.body.elsewhereInCatalogue).toEqual([
      { id: 'w2', category: 'wine', label: 'Domaine B Chardonnay', avgRating: undefined, reason: 'out of stock but rated well' },
      { id: 'b1', category: 'beer', label: 'Brew Co IPA', avgRating: undefined, reason: 'hoppy and refreshing' },
    ]);
  });

  it('puts a candidate with no collection field at all into elsewhereInCatalogue', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      results: [{ id: 'b1', category: 'beer', reason: 'hoppy' }],
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.inCollection).toEqual([]);
    expect(res.body.elsewhereInCatalogue).toHaveLength(1);
    expect(res.body.elsewhereInCatalogue[0].id).toBe('b1');
  });

  it('ignores malformed entries and defaults a missing reason to empty string', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      results: [
        null,
        { id: 5, category: 'wine' },
        { id: 'w1', category: 5 },
        { id: 'w1', category: 'wine' },
      ],
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.inCollection).toEqual([
      { id: 'w1', category: 'wine', label: 'Domaine A Pinot Noir', avgRating: undefined, reason: '' },
    ]);
  });

  it('treats a missing "results" key as an empty list', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ toBuy: [] }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.inCollection).toEqual([]);
    expect(res.body.elsewhereInCatalogue).toEqual([]);
  });

  it('drops a result whose id does not exist in the catalogue', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      results: [
        { id: 'w1', category: 'wine', reason: 'real' },
        { id: 'made-up', category: 'wine', reason: 'hallucinated' },
      ],
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.inCollection).toHaveLength(1);
    expect(res.body.inCollection[0].id).toBe('w1');
  });

  it('drops a result whose id exists but under the wrong category', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      results: [{ id: 'w1', category: 'beer', reason: 'wrong category' }],
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.inCollection).toEqual([]);
    expect(res.body.elsewhereInCatalogue).toEqual([]);
  });

  it('caps combined results at 15', async () => {
    const wine = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`, producer: 'P', seriesAndName: `Wine ${i}`, variety: 'Red', country: 'France', region: 'R', abv: '13', tags: [],
    }));
    await writeFixture({ wine, beer: [] });
    global.fetch.mockResolvedValue(jsonResponse({
      results: wine.map(w => ({ id: w.id, category: 'wine', reason: 'r' })),
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.inCollection.length + res.body.elsewhereInCatalogue.length).toBe(15);
  });

  it('returns toBuy entries, requiring a URL and capping at 6', async () => {
    const toBuy = Array.from({ length: 8 }, (_, i) => ({ name: `Drink ${i}`, description: 'd', url: `https://example.com/${i}`, reason: 'r' }));
    toBuy.push({ name: 'No link', description: 'd', reason: 'r' });
    global.fetch.mockResolvedValue(jsonResponse({ results: [], toBuy }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.toBuy).toHaveLength(6);
    expect(res.body.toBuy.every(e => e.url)).toBe(true);
  });

  it('dedupes toBuy against the full catalogue, including out-of-stock entries', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      results: [],
      toBuy: [
        { name: 'Domaine B Chardonnay', description: 'already owned, out of stock', url: 'https://example.com/x', reason: 'r' },
        { name: 'New Find', description: 'not in catalogue', url: 'https://example.com/y', reason: 'r' },
      ],
    }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.toBuy).toHaveLength(1);
    expect(res.body.toBuy[0].name).toBe('New Find');
  });

  it('retries once on a transient 503 and succeeds', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when the JSON block is malformed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '```json\n{not valid\n```' }] } }] }),
    });
    const res = await request(app).post('/api/generate-list').send({ prompt: 'anything' });
    expect(res.status).toBe(502);
  });

  it('sends the google_search tool config for generate-list', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ results: [] }));
    await request(app).post('/api/generate-list').send({ prompt: 'something bold' });
    const [, opts] = global.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.tools).toEqual([{ google_search: {} }]);
    const promptText = body.contents[0].parts[0].text;
    expect(promptText).toContain('something bold');
    expect(promptText).toContain('"id": "w1"');
  });
});
