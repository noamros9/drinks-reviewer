const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

let app;
let tmpDir;

const WINE = [
  { id: 'w1', producer: 'Domaine A', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: [] },
  { id: 'w2', producer: 'Domaine B', seriesAndName: 'Pinot Noir', variety: 'Pinot Noir', country: 'France', region: 'Burgundy', abv: '13', tags: [] },
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
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(payload) + '\n```' }],
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
  process.env.ANTHROPIC_API_KEY = 'test-key';
  jest.resetModules();
  app = require('../index');
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete global.fetch;
  jest.resetModules();
});

describe('POST /api/recommend', () => {
  it('returns 400 when no seeds are given', async () => {
    const res = await request(app).post('/api/recommend').send({ seeds: [] });
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a single seed', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ ownCatalogue: [], availableInIsrael: [], notAvailable: [] }));
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

  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
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

  it('returns 502 when the Anthropic API call fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 when no JSON block is found in the response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'no json here' }] }),
    });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('returns 502 when the response has no content blocks at all', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('drops an ownCatalogue entry that references an unknown category', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      ownCatalogue: [{ id: 'x', category: 'mystery', reason: 'r' }],
    }));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.ownCatalogue).toEqual([]);
  });

  it('returns 502 when the JSON block is malformed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: '```json\n{not valid\n```' }] }),
    });
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(502);
  });

  it('drops an invented ownCatalogue id and an availableInIsrael entry with no url, caps the combined external list', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      ownCatalogue: [{ id: 'w3', category: 'wine' }, { id: 'invented', category: 'wine', reason: 'x' }],
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
    expect(res.body.ownCatalogue).toEqual([{ id: 'w3', category: 'wine', label: 'Domaine C Chardonnay', reason: '' }]);
    expect(res.body.availableInIsrael).toEqual([{ name: 'Real Bottle', description: 'd', url: 'https://example.com/a', reason: 'r' }]);
    expect(res.body.ownCatalogue.length + res.body.availableInIsrael.length + res.body.notAvailable.length).toBeLessThanOrEqual(11);
    expect(res.body.notAvailable.length).toBe(7);
  });

  it('defaults every result group to an empty array when the model omits them', async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));
    const res = await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ownCatalogue: [], availableInIsrael: [], notAvailable: [] });
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

  it('sends web_search tool config and excludes seed drinks from the candidate pool', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ ownCatalogue: [], availableInIsrael: [], notAvailable: [] }));
    await request(app).post('/api/recommend').send({
      seeds: [{ id: 'w1', category: 'wine' }, { id: 'w2', category: 'wine' }],
    });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(opts.body);
    expect(body.tools[0].type).toBe('web_search_20250305');
    const seedIdOccurrences = (body.messages[0].content.match(/"id": "w1"/g) || []).length;
    expect(seedIdOccurrences).toBe(1); // only in the seed list, not duplicated in the candidate pool
    expect(body.messages[0].content).toContain('"id": "w3"');
  });
});
