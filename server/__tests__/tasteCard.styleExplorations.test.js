const request = require('supertest');

let app;
let db;

const WINE = [
  { id: 'w1', producer: 'Domaine A', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light', 'earthy'], avgRating: 8, tastingCount: 3 },
  { id: 'w2', producer: 'Domaine B', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13.5', tags: ['light'], avgRating: 9, tastingCount: 2 },
  { id: 'w3', producer: 'Domaine C', seriesAndName: 'Chardonnay', variety: 'Chardonnay', country: 'Chile', region: 'Maipo', abv: '12.5', tags: ['oaky'], avgRating: 6, tastingCount: 1 },
  { id: 'w4', producer: 'Domaine D', seriesAndName: 'Unrated Wine', variety: 'Malbec', country: 'Argentina', region: 'Mendoza', abv: '14', tags: [] }, // no avgRating -> excluded
  { id: 'w5', producer: 'Domaine E', seriesAndName: 'Merlot', variety: 'Merlot', country: 'Spain', region: 'Rioja', abv: '13', tags: ['bitter'], avgRating: 3, tastingCount: 2 }, // low rating -> disliked bucket
];

const BEER = [];

async function writeFixture() {
  db.resetFake();
  const wineCol = await db.getCollection('wine');
  await wineCol.insertMany(WINE);
  const beerCol = await db.getCollection('beer');
  await beerCol.insertMany(BEER);
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

describe('POST /api/taste-card styleExplorations', () => {
  it('returns an empty array when Gemini omits the field', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toEqual([]);
  });

  it('returns an empty array when the field is not an array', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [], styleExplorations: 'nope' }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toEqual([]);
  });

  it('filters out an entry that is not an object', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [null, { style: 'Amarone', availableInIsrael: [{ name: 'X', url: 'https://x.com' }], notAvailable: [] }],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toHaveLength(1);
    expect(res.body.styleExplorations[0].style).toBe('Amarone');
  });

  it('filters out an entry with a missing or empty style name', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [
        { availableInIsrael: [{ name: 'X', url: 'https://x.com' }], notAvailable: [] },
        { style: '  ', availableInIsrael: [{ name: 'Y', url: 'https://y.com' }], notAvailable: [] },
      ],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toEqual([]);
  });

  it('keeps a style with only availableInIsrael examples', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [{ style: 'Amarone', why: 'ripe fruit + tannin', availableInIsrael: [{ name: 'X', url: 'https://x.com' }], notAvailable: [] }],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toHaveLength(1);
    expect(res.body.styleExplorations[0].availableInIsrael).toHaveLength(1);
    expect(res.body.styleExplorations[0].notAvailable).toEqual([]);
  });

  it('keeps a style with only notAvailable examples', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [{ style: 'Amarone', availableInIsrael: [], notAvailable: [{ name: 'X' }] }],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toHaveLength(1);
    expect(res.body.styleExplorations[0].availableInIsrael).toEqual([]);
    expect(res.body.styleExplorations[0].notAvailable).toHaveLength(1);
  });

  it("drops a style's example already in the catalogue", async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [{
        style: 'Amarone',
        availableInIsrael: [{ name: 'Domaine C Chardonnay', url: 'https://x.com' }],
        notAvailable: [],
      }],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toEqual([]);
  });

  it('drops a style entirely when nothing survives filtering (missing url)', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [{ style: 'Amarone', availableInIsrael: [{ name: 'X' }], notAvailable: [] }],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toEqual([]);
  });

  it('caps to 5 style explorations when 7 are supplied', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: Array.from({ length: 7 }, (_, i) => ({
        style: `Style${i}`, availableInIsrael: [{ name: `X${i}`, url: `https://x.com/${i}` }], notAvailable: [],
      })),
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.body.styleExplorations).toHaveLength(5);
  });

  it("caps a single style's combined examples to 2", async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [], notAvailable: [],
      styleExplorations: [{
        style: 'Amarone',
        availableInIsrael: [{ name: 'A1', url: 'https://x.com/1' }, { name: 'A2', url: 'https://x.com/2' }],
        notAvailable: [{ name: 'N1' }, { name: 'N2' }],
      }],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    const se = res.body.styleExplorations[0];
    expect(se.availableInIsrael).toHaveLength(2);
    expect(se.notAvailable).toHaveLength(0);
  });
});
