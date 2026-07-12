const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

let app;
let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-test-'));
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    fs.writeFileSync(path.join(tmpDir, `${cat}.json`), '[]');
  });
  process.env.DATA_DIR = tmpDir;
  jest.resetModules();
  app = require('../index');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.DATA_DIR;
  jest.resetModules();
});

beforeEach(() => {
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    fs.writeFileSync(path.join(tmpDir, `${cat}.json`), '[]');
  });
  fs.writeFileSync(path.join(tmpDir, 'region-coordinates.json'), '{}');
});

describe('GET /api/:category', () => {
  it('returns empty array for empty category', async () => {
    const res = await request(app).get('/api/wine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });

  it('filters out collectionOnly entries', async () => {
    await request(app).post('/api/wine').send({ producer: 'Normal', collectionOnly: false });
    await request(app).post('/api/wine').send({ producer: 'Hidden', collectionOnly: true });
    const res = await request(app).get('/api/wine');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].producer).toBe('Normal');
  });
});

describe('POST /api/:category', () => {
  it('adds entry with auto-generated id', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'Château Test', seriesAndName: 'Reserve 2021' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.producer).toBe('Château Test');
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).post('/api/spirits').send({ name: 'Test' });
    expect(res.status).toBe(404);
  });

  it('sets collectionOnly when sent as true', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', collectionOnly: true });
    expect(res.body.collectionOnly).toBe(true);
  });

  it('does not set collectionOnly when not sent', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X' });
    expect(res.body.collectionOnly).toBeUndefined();
  });

  it('returns 400 for abv below 0', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', abv: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for abv above 100', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', abv: 101 });
    expect(res.status).toBe(400);
  });

  it('accepts a non-numeric abv value (free-text tolerated)', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', abv: '14%' });
    expect(res.status).toBe(201);
  });

  it('accepts a numeric abv within the valid range', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', abv: 13.5 });
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/:category/:id', () => {
  it('updates an existing entry', async () => {
    const createRes = await request(app).post('/api/wine').send({ producer: 'Original' });
    const id = createRes.body.id;
    const updateRes = await request(app).put(`/api/wine/${id}`).send({ producer: 'Updated' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.producer).toBe('Updated');
    expect(updateRes.body.id).toBe(id);
  });

  it('returns 404 for non-existent entry', async () => {
    const res = await request(app).put('/api/wine/nonexistent-id').send({ producer: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).put('/api/spirits/abc').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for out-of-range abv on update', async () => {
    const createRes = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).put(`/api/wine/${createRes.body.id}`).send({ producer: 'X', abv: 150 });
    expect(res.status).toBe(400);
  });

  it('clears collectionOnly when PUT sends collectionOnly: false', async () => {
    const { body: drink } = await request(app).post('/api/wine').send({ producer: 'X', collectionOnly: true });
    await request(app).put(`/api/wine/${drink.id}`).send({ producer: 'X', collectionOnly: false });
    const res = await request(app).get('/api/wine');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].collectionOnly).toBeUndefined();
  });

  it('sets collectionOnly to true via PUT', async () => {
    const { body: drink } = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).put(`/api/wine/${drink.id}`).send({ producer: 'X', collectionOnly: true });
    expect(res.body.collectionOnly).toBe(true);
  });

  it('preserves fields omitted from PUT body', async () => {
    const createRes = await request(app).post('/api/wine').send({ producer: 'X', abv: '14%', region: 'Bordeaux' });
    const id = createRes.body.id;
    const updateRes = await request(app).put(`/api/wine/${id}`).send({ producer: 'Y' });
    expect(updateRes.body.abv).toBe('14%');
    expect(updateRes.body.region).toBe('Bordeaux');
  });
});

describe('DELETE /api/:category/:id', () => {
  it('removes the entry', async () => {
    const createRes = await request(app).post('/api/beer').send({ brewery: 'Test Brew', name: 'Test IPA' });
    const id = createRes.body.id;
    const deleteRes = await request(app).delete(`/api/beer/${id}`);
    expect(deleteRes.status).toBe(204);
    const getRes = await request(app).get('/api/beer');
    expect(getRes.body).toHaveLength(0);
  });

  it('returns 404 for non-existent entry', async () => {
    const res = await request(app).delete('/api/beer/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).delete('/api/spirits/abc');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/:category/:id preserves collection', () => {
  it('preserves collection field when updating other fields', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X', seriesAndName: 'Y' });
    await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 2 });
    await request(app).put(`/api/wine/${wine.body.id}`).send({ producer: 'Updated' });
    const res = await request(app).get('/api/collection');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].producer).toBe('Updated');
    expect(res.body[0].collection[0].quantity).toBe(2);
  });
});

describe('GET /api/collection', () => {
  it('returns empty array when no drinks have in-stock lots', async () => {
    const res = await request(app).get('/api/collection');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns drinks with in-stock lots, annotated with _category', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'Test', seriesAndName: 'X' });
    await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 2, price: 30 });
    const res = await request(app).get('/api/collection');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]._category).toBe('wine');
    expect(res.body[0].collection[0].quantity).toBe(2);
  });

  it('excludes drinks where all lots have quantity 0', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'Empty', seriesAndName: 'Y' });
    const lot = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 1 });
    await request(app).patch(`/api/wine/${wine.body.id}/collection/${lot.body.id}`).send({ quantity: 0 });
    const res = await request(app).get('/api/collection');
    expect(res.body).toHaveLength(0);
  });

  it('excludes drinks with no collection property (covers drink.collection || [] branch)', async () => {
    await request(app).post('/api/wine').send({ producer: 'No Collection' });
    const res = await request(app).get('/api/collection');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('aggregates drinks from multiple categories', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'W' });
    const beer = await request(app).post('/api/beer').send({ brewery: 'B' });
    await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 1 });
    await request(app).post(`/api/beer/${beer.body.id}/collection`).send({ quantity: 1 });
    const res = await request(app).get('/api/collection');
    expect(res.body).toHaveLength(2);
    const categories = res.body.map(d => d._category).sort();
    expect(categories).toEqual(['beer', 'wine']);
  });
});

describe('POST /api/:category/:id/collection', () => {
  it('adds a lot with quantity and price', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 3, price: 45 });
    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(3);
    expect(res.body.price).toBe(45);
    expect(res.body.id).toBeDefined();
    expect(res.body.addedAt).toBeDefined();
  });

  it('stores null price when price is omitted', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 1 });
    expect(res.body.price).toBeNull();
  });

  it('returns 400 for quantity 0', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer quantity', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 1.5 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).post('/api/unknown/123/collection').send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown drink id', async () => {
    const res = await request(app).post('/api/wine/nonexistent/collection').send({ quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/:category/:id/collection/:lotId', () => {
  it('returns 404 for unknown drink id', async () => {
    const res = await request(app).patch('/api/wine/nonexistent/collection/lot1').send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('updates lot quantity', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const lot = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 2 });
    const res = await request(app).patch(`/api/wine/${wine.body.id}/collection/${lot.body.id}`).send({ quantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(5);
  });

  it('allows setting quantity to 0', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const lot = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 2 });
    const res = await request(app).patch(`/api/wine/${wine.body.id}/collection/${lot.body.id}`).send({ quantity: 0 });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(0);
  });

  it('returns 400 for negative quantity', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const lot = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 2 });
    const res = await request(app).patch(`/api/wine/${wine.body.id}/collection/${lot.body.id}`).send({ quantity: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown lot', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).patch(`/api/wine/${wine.body.id}/collection/nonexistent`).send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).patch('/api/unknown/123/collection/lot1').send({ quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/:category/:id/collection/:lotId', () => {
  it('returns 404 for unknown drink id', async () => {
    const res = await request(app).delete('/api/wine/nonexistent/collection/lot1');
    expect(res.status).toBe(404);
  });

  it('removes a lot', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const lot = await request(app).post(`/api/wine/${wine.body.id}/collection`).send({ quantity: 1 });
    const res = await request(app).delete(`/api/wine/${wine.body.id}/collection/${lot.body.id}`);
    expect(res.status).toBe(204);
    const collection = await request(app).get('/api/collection');
    expect(collection.body).toHaveLength(0);
  });

  it('returns 404 for unknown lot', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).delete(`/api/wine/${wine.body.id}/collection/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).delete('/api/unknown/123/collection/lot1');
    expect(res.status).toBe(404);
  });
});

describe('tags field', () => {
  it('saves tags array on wine', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', tags: ['gift', 'cellar'] });
    expect(res.body.tags).toEqual(['gift', 'cellar']);
  });

  it('defaults tags to empty array when omitted', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X' });
    expect(res.body.tags).toEqual([]);
  });

  it('saves tags on beer', async () => {
    const res = await request(app).post('/api/beer').send({ brewery: 'B', tags: ['organic'] });
    expect(res.body.tags).toEqual(['organic']);
  });

  it('sweetness is saved on wine', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', sweetness: 'Dry' });
    expect(res.body.sweetness).toBe('Dry');
  });

  it('sweetness is not allowed on beer', async () => {
    const res = await request(app).post('/api/beer').send({ brewery: 'B', sweetness: 'Dry' });
    expect(res.body.sweetness).toBeUndefined();
  });

  it('vivinoScore is saved on wine', async () => {
    const res = await request(app).post('/api/wine').send({ producer: 'X', vivinoScore: 4.2 });
    expect(res.body.vivinoScore).toBe(4.2);
  });

  it('vivinoScore is not allowed on beer', async () => {
    const res = await request(app).post('/api/beer').send({ brewery: 'B', vivinoScore: 4.2 });
    expect(res.body.vivinoScore).toBeUndefined();
  });
});

describe('GET /api/tags', () => {
  it('returns empty array when no drinks have tags', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('handles drinks with no tags field (covers d.tags || [] branch)', async () => {
    const data = [{ id: 'x', producer: 'Y' }]; // no tags property
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), JSON.stringify(data));
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns unique tags sorted alphabetically across categories', async () => {
    await request(app).post('/api/wine').send({ producer: 'W', tags: ['gift', 'organic'] });
    await request(app).post('/api/beer').send({ brewery: 'B', tags: ['organic', 'cellar'] });
    const res = await request(app).get('/api/tags');
    expect(res.body).toEqual(['cellar', 'gift', 'organic']);
  });
});

describe('GET /api/region-coordinates', () => {
  it('returns {} when nothing has been geocoded yet', async () => {
    const res = await request(app).get('/api/region-coordinates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns the cached coordinates file contents', async () => {
    fs.writeFileSync(path.join(tmpDir, 'region-coordinates.json'), JSON.stringify({ 'Spain||Rioja': { lat: 1, lon: 2 } }));
    const res = await request(app).get('/api/region-coordinates');
    expect(res.body).toEqual({ 'Spain||Rioja': { lat: 1, lon: 2 } });
  });
});

describe('region geocoding hook on save', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([{ lat: '42.4', lon: '-2.4' }]) });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('geocodes a new wine entry with both country and region set', async () => {
    await request(app).post('/api/wine').send({ producer: 'X', country: 'Spain', region: 'Rioja' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const coords = JSON.parse(fs.readFileSync(path.join(tmpDir, 'region-coordinates.json'), 'utf8'));
    expect(coords['Spain||Rioja']).toEqual({ lat: 42.4, lon: -2.4 });
  });

  it('geocodes a whiskey entry updated to add both country and region', async () => {
    const { body: drink } = await request(app).post('/api/whiskey').send({ distillery: 'X' });
    await request(app).put(`/api/whiskey/${drink.id}`).send({ distillery: 'X', country: 'Scotland', region: 'Speyside' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not geocode when only one of country/region is set', async () => {
    await request(app).post('/api/wine').send({ producer: 'X', country: 'Spain' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not geocode categories with no region field (beer/others)', async () => {
    await request(app).post('/api/beer').send({ brewery: 'X', country: 'Germany' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a geocoding failure still returns a successful save response', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const res = await request(app).post('/api/wine').send({ producer: 'X', country: 'Spain', region: 'Rioja' });
    expect(res.status).toBe(201);
    expect(res.body.producer).toBe('X');
  });
});

describe('500 error handling when data file is corrupt', () => {
  beforeEach(() => {
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), 'INVALID JSON');
  });
  afterEach(() => {
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), '[]');
  });

  it('GET /api/tags returns 500', async () => {
    expect((await request(app).get('/api/tags')).status).toBe(500);
  });
  it('GET /api/collection returns 500', async () => {
    expect((await request(app).get('/api/collection')).status).toBe(500);
  });
  it('GET /api/wine returns 500', async () => {
    expect((await request(app).get('/api/wine')).status).toBe(500);
  });
  it('POST /api/wine returns 500', async () => {
    expect((await request(app).post('/api/wine').send({ producer: 'X' })).status).toBe(500);
  });
  it('PUT /api/wine/:id returns 500', async () => {
    expect((await request(app).put('/api/wine/any-id').send({ producer: 'X' })).status).toBe(500);
  });
  it('DELETE /api/wine/:id returns 500', async () => {
    expect((await request(app).delete('/api/wine/any-id')).status).toBe(500);
  });
  it('PATCH /api/wine/bulk returns 500', async () => {
    const res = await request(app).patch('/api/wine/bulk').send({ ids: ['any-id'], field: 'region', value: 'X' });
    expect(res.status).toBe(500);
  });
  it('POST /api/wine/:id/tastings returns 500', async () => {
    expect((await request(app).post('/api/wine/any-id/tastings').send({ date: '01/01/2025', rating: 7 })).status).toBe(500);
  });
  it('DELETE /api/wine/:id/tastings/:tastingId returns 500', async () => {
    expect((await request(app).delete('/api/wine/any-id/tastings/t1')).status).toBe(500);
  });
  it('PUT /api/wine/:id/tastings/:tastingId returns 500', async () => {
    expect((await request(app).put('/api/wine/any-id/tastings/t1').send({ date: '01/01/2025', rating: 7 })).status).toBe(500);
  });
  it('POST /api/wine/:id/tastings/:tastingId/image returns 500', async () => {
    const res = await request(app)
      .post('/api/wine/any-id/tastings/t1/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
  });
  it('POST /api/wine/:id/collection returns 500', async () => {
    expect((await request(app).post('/api/wine/any-id/collection').send({ quantity: 1 })).status).toBe(500);
  });
  it('PATCH /api/wine/:id/collection/:lotId returns 500', async () => {
    expect((await request(app).patch('/api/wine/any-id/collection/lot1').send({ quantity: 2 })).status).toBe(500);
  });
  it('DELETE /api/wine/:id/collection/:lotId returns 500', async () => {
    expect((await request(app).delete('/api/wine/any-id/collection/lot1')).status).toBe(500);
  });
});
