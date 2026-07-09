const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

let app;
let tmpDir;

const WINE = [
  { id: 'w1', producer: 'Domaine A', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light', 'earthy'] },
  { id: 'w2', producer: 'Domaine B', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light'] },
  { id: 'w3', producer: 'Domaine C', seriesAndName: 'Chardonnay', variety: 'Chardonnay', country: 'France', region: 'Chablis', abv: '12.5', tags: [] },
];

const BEER = [{ id: 'b1', brewery: 'Brew Co', name: 'IPA', style: 'IPA', country: 'USA', abv: '6', tags: [] }];
const WHISKEY = [{ id: 'wh1', distillery: 'Glen X', name: '12yo', country: 'Scotland', region: 'Speyside', age: '12', style: 'Single Malt', abv: '40', tags: [] }];
// no producer/brewery/distillery/name/seriesAndName -> exercises label()'s 'Unknown' fallback
const OTHERS = [{ id: 'o1', drinkCategory: 'Sake', country: 'Japan', style: 'Junmai', age: '', abv: '15', tags: [] }];

function writeFixture() {
  fs.writeFileSync(path.join(tmpDir, 'wine.json'), JSON.stringify(WINE));
  fs.writeFileSync(path.join(tmpDir, 'beer.json'), JSON.stringify(BEER));
  fs.writeFileSync(path.join(tmpDir, 'whiskey.json'), JSON.stringify(WHISKEY));
  fs.writeFileSync(path.join(tmpDir, 'others.json'), JSON.stringify(OTHERS));
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recommend-test-'));
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

describe('scoreSimilarity', () => {
  const { scoreSimilarity } = require('../recommend');

  it('ranks an exact-match candidate above a partial match', () => {
    const seeds = [{ category: 'wine', producer: 'Domaine A', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light', 'earthy'] }];
    const exact = { category: 'wine', producer: 'Domaine A', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light', 'earthy'] };
    const partial = { category: 'wine', producer: 'Domaine C', variety: 'Chardonnay', country: 'France', region: 'Chablis', abv: '12.5', tags: [] };
    expect(scoreSimilarity(seeds, exact)).toBeGreaterThan(scoreSimilarity(seeds, partial));
  });

  it('scores zero when nothing matches', () => {
    const seeds = [{ category: 'wine', producer: 'Domaine A', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: ['light'] }];
    const candidate = { category: 'wine', producer: 'Nobody', variety: 'Riesling', country: 'Germany', region: 'Mosel', abv: '9', tags: ['sweet'] };
    expect(scoreSimilarity(seeds, candidate)).toBe(0);
  });

  it('ignores candidates from a different category than any seed', () => {
    const seeds = [{ category: 'wine', producer: 'Domaine A', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: [] }];
    const candidate = { category: 'beer', brewery: 'Brew Co', name: 'IPA', style: 'IPA', country: 'USA', abv: '6', tags: [] };
    expect(scoreSimilarity(seeds, candidate)).toBe(0);
  });

  it('treats a non-numeric numeric field as no match instead of crashing', () => {
    const seeds = [{ category: 'wine', producer: 'Domaine A', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: 'unknown', tags: [] }];
    const candidate = { category: 'wine', producer: 'Domaine A', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: [] };
    expect(() => scoreSimilarity(seeds, candidate)).not.toThrow();
    expect(scoreSimilarity(seeds, candidate)).toBe(4); // producer + variety + country + region, abv excluded
  });
});

describe('POST /api/recommend', () => {
  it('returns 400 when no seeds are given', async () => {
    const res = await request(app).post('/api/recommend').send({ seeds: [] });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a single seed', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/recommend').send({ seeds: [{ id: 'w1', category: 'wine' }] });
    expect(res.status).toBe(200);
  });

  it('returns 400 when a seed references an unknown category', async () => {
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'x', category: 'mystery' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/x/);
  });

  it('returns 400 when a seed id does not exist', async () => {
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'nope', category: 'wine' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nope/);
  });

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('returns 500 when a catalogue file cannot be read', async () => {
    fs.rmSync(path.join(tmpDir, 'wine.json'));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(500);
  });

  it('returns 500 on an unexpected error with no status (e.g. a network failure)', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(500);
  });

  it('returns 502 when the Gemini API call fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 immediately on a non-503 failure, without retrying', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400 });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once on a transient 503 and succeeds', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when no JSON block is found in the response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'no json here' }] } }] }),
    });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 when the response has no candidates at all', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 when a candidate has no content key at all (e.g. safety-blocked)', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ candidates: [{ finishReason: 'SAFETY' }] }) });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('filters out an availableInIsrael/notAvailable entry that matches a drink already in the catalogue', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [
        { name: 'Domaine C Chardonnay', description: 'd', url: 'https://example.com/a', reason: 'r' },
        { name: 'Genuinely New Wine', description: 'd', url: 'https://example.com/b', reason: 'r' },
      ],
      notAvailable: [{ name: 'Domaine C Chardonnay', description: 'd', reason: 'r' }],
    }));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.availableInIsrael).toEqual([{ name: 'Genuinely New Wine', description: 'd', url: 'https://example.com/b', reason: 'r' }]);
    expect(res.body.notAvailable).toEqual([]);
  });

  it('treats an availableInIsrael entry missing a name as not already owned', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [{ description: 'd', url: 'https://example.com/a', reason: 'r' }],
      notAvailable: [],
    }));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.availableInIsrael).toHaveLength(1);
  });

  it('populates ownCatalogue locally without calling fetch for it', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.ownCatalogue).toEqual([{ id: 'w3', category: 'wine', label: 'Domaine C Chardonnay', reason: 'Similar country, ABV' }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 502 when the JSON block is malformed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '```json\n{not valid\n```' }] } }] }),
    });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('drops an availableInIsrael entry with no url, caps the combined external list', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: [
        { name: 'Real Bottle', description: 'd', url: 'https://example.com/a', reason: 'r' },
        { name: 'No Link Bottle', description: 'd', reason: 'r' },
      ],
      notAvailable: Array.from({ length: 10 }, (_, i) => ({ name: `Bottle ${i}`, description: 'd', reason: 'r' })),
    }));

    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.availableInIsrael).toEqual([{ name: 'Real Bottle', description: 'd', url: 'https://example.com/a', reason: 'r' }]);
    expect(res.body.availableInIsrael.length + res.body.notAvailable.length).toBeLessThanOrEqual(8);
    expect(res.body.notAvailable.length).toBe(7);
  });

  it('defaults the model-sourced groups to empty arrays when the model omits them', async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.availableInIsrael).toEqual([]);
    expect(res.body.notAvailable).toEqual([]);
  });

  it('drops notAvailable entirely once availableInIsrael already fills the combined cap', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      availableInIsrael: Array.from({ length: 9 }, (_, i) => ({ name: `B${i}`, description: 'd', url: `https://x.com/${i}`, reason: 'r' })),
      notAvailable: [{ name: 'Should be dropped', description: 'd', reason: 'r' }],
    }));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.availableInIsrael.length).toBe(8);
    expect(res.body.notAvailable).toEqual([]);
  });

  it('sends the google_search tool config to Gemini and excludes seed drinks from the prompt', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ availableInIsrael: [], notAvailable: [] }));
    await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).not.toContain('test-key'); // key must go in a header, never the URL
    expect(opts.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(opts.body);
    expect(body.tools[0].google_search).toEqual({});
    const promptText = body.contents[0].parts[0].text;
    expect(promptText).toContain('"id": "w1"');
    expect(promptText).not.toContain('"id": "w3"'); // candidate pool no longer sent to the model
  });
});
