const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

let app;
let tmpDir;

const WINE = [
  { id: 'w1', producer: 'Domaine A', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light', 'earthy'], avgRating: 8, tastingCount: 3 },
  { id: 'w2', producer: 'Domaine B', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13.5', tags: ['light'], avgRating: 9, tastingCount: 2 },
  { id: 'w3', producer: 'Domaine C', seriesAndName: 'Chardonnay', variety: 'Chardonnay', country: 'Chile', region: 'Maipo', abv: '12.5', tags: ['oaky'], avgRating: 6, tastingCount: 1 },
  { id: 'w4', producer: 'Domaine D', seriesAndName: 'Unrated Wine', variety: 'Malbec', country: 'Argentina', region: 'Mendoza', abv: '14', tags: [] }, // no avgRating -> excluded
  { id: 'w5', producer: 'Domaine E', seriesAndName: 'Merlot', variety: 'Merlot', country: 'Spain', region: 'Rioja', abv: '13', tags: ['bitter'], avgRating: 3, tastingCount: 2 }, // low rating -> disliked bucket
];

const BEER = [];

function writeFixture() {
  fs.writeFileSync(path.join(tmpDir, 'wine.json'), JSON.stringify(WINE));
  fs.writeFileSync(path.join(tmpDir, 'beer.json'), JSON.stringify(BEER));
  fs.writeFileSync(path.join(tmpDir, 'whiskey.json'), JSON.stringify([]));
  fs.writeFileSync(path.join(tmpDir, 'others.json'), JSON.stringify([]));
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

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taste-card-test-'));
  process.env.DATA_DIR = tmpDir;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.DATA_DIR;
});

beforeEach(() => {
  writeFixture();
  process.env.GEMINI_API_KEY = 'test-key';
  jest.resetModules();
  app = require('../index');
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete global.fetch;
  jest.resetModules();
});

describe('POST /api/taste-card', () => {
  it('returns 400 for an unknown category', async () => {
    const res = await request(app).post('/api/taste-card').send({ category: 'mystery' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mystery/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing category', async () => {
    const res = await request(app).post('/api/taste-card').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when the category has no rated drinks', async () => {
    const res = await request(app).post('/api/taste-card').send({ category: 'beer' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No rated drinks/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('returns 500 when a catalogue file cannot be read', async () => {
    fs.rmSync(path.join(tmpDir, 'wine.json'));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(500);
  });

  it('computes a taste profile weighted toward higher-rated entries, excluding unrated drinks', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(200);
    const { profile, disliked } = res.body;
    expect(profile.category).toBe('wine');
    expect(profile.entryCount).toBe(4); // w4 excluded (no avgRating)
    expect(profile.variety).toBe('Pinot Noir'); // w1+w2 outweigh w3
    expect(profile.country).toBe('France');
    expect(profile.topTags).toEqual(expect.arrayContaining(['light']));
    expect(profile.abv.min).toBe(12.5);
    expect(profile.abv.max).toBe(13.5);
    expect(disliked.entryCount).toBe(1); // w5, the only entry below DISLIKE_THRESHOLD
    expect(disliked.variety).toBe('Merlot');
  });

  it('sends the taste profile (not raw drinks) to Gemini and applies the raised caps', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      analysis: 'You lean toward light, earthy Pinot Noir from France, and tend to avoid Merlot.',
      availableInIsrael: Array.from({ length: 20 }, (_, i) => ({ name: `B${i}`, description: 'd', url: `https://x.com/${i}`, reason: 'r' })),
      notAvailable: Array.from({ length: 20 }, (_, i) => ({ name: `N${i}`, description: 'd', reason: 'r' })),
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(200);
    expect(res.body.analysis).toBe('You lean toward light, earthy Pinot Noir from France, and tend to avoid Merlot.');
    expect(res.body.availableInIsrael.length).toBe(15);
    expect(res.body.availableInIsrael.length + res.body.notAvailable.length).toBeLessThanOrEqual(30);
    expect(res.body.notAvailable.length).toBe(15);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    const promptText = JSON.parse(opts.body).contents[0].parts[0].text;
    expect(promptText).toContain('"variety": "Pinot Noir"');
    expect(promptText).toContain('"variety": "Merlot"'); // disliked profile reaches the prompt
    expect(promptText).not.toContain('"id": "w1"'); // profile sent, not raw seed drinks
  });

  it('dedupes recommendations against drinks already in the catalogue', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [{ name: 'Domaine C Chardonnay', description: 'd', url: 'https://example.com/a', reason: 'r' }],
      notAvailable: [],
    }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(200);
    expect(res.body.availableInIsrael).toEqual([]);
  });

  it('handles a rated drink with no tags and no valid numeric field value', async () => {
    const fixture = [
      { id: 'x1', producer: 'X', seriesAndName: 'Nameless', variety: 'Zinfandel', country: 'USA', avgRating: 7, tastingCount: 1 }, // no tags, no abv
    ];
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), JSON.stringify(fixture));
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(200);
    expect(res.body.profile.topTags).toEqual([]);
    expect(res.body.profile.abv).toBeNull();
  });

  it('returns disliked: null and tells Gemini there is no clear dislike pattern when nothing is rated low', async () => {
    const highOnly = WINE.filter(d => typeof d.avgRating === 'number' && d.avgRating >= 5);
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), JSON.stringify(highOnly));
    global.fetch.mockResolvedValue(jsonResponse({ analysis: 'You like big reds.', availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(200);
    expect(res.body.disliked).toBeNull();
    expect(res.body.analysis).toBe('You like big reds.');
    const [, opts] = global.fetch.mock.calls[0];
    const promptText = JSON.parse(opts.body).contents[0].parts[0].text;
    expect(promptText).toContain("haven't rated enough drinks poorly yet");
  });

  it('reports near-tied fields as an array of values instead of picking one arbitrarily', async () => {
    const TIED = [
      { id: 't1', producer: 'X', seriesAndName: 'A', variety: 'Syrah', country: 'France', abv: '13', tags: [], avgRating: 8, tastingCount: 2 },
      { id: 't2', producer: 'Y', seriesAndName: 'B', variety: 'Grenache', country: 'France', abv: '13', tags: [], avgRating: 8, tastingCount: 2 },
    ];
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), JSON.stringify(TIED));
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(200);
    expect(res.body.profile.variety).toEqual(['Syrah', 'Grenache']);
  });

  it('returns 500 on an unexpected error with no status (e.g. a network failure)', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(500);
  });

  it('returns 502 when the Gemini API call fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await request(app).post('/api/taste-card').send({ category: 'wine' });
    expect(res.status).toBe(502);
  });

  describe('styleExplorations', () => {
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
});
