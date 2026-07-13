const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../cloudinary', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/v1/drinks/fake.png'),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

let app;
let db;
let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-search-test-'));
  process.env.DATA_DIR = tmpDir;
  jest.resetModules();
  app = require('../index');
  db = require('../db');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.DATA_DIR;
  jest.resetModules();
});

beforeEach(() => {
  db.resetFake();
});

describe('GET /api/:category/search', () => {
  it('returns 404 for unknown category', async () => {
    const res = await request(app).get('/api/unknown/search?q=x');
    expect(res.status).toBe(404);
  });

  it('returns an empty array without a query, no DB hit needed', async () => {
    const res = await request(app).get('/api/wine/search');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns an empty array for a blank/whitespace query', async () => {
    const res = await request(app).get('/api/wine/search?q=%20%20');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns entries whose producer or name matches the query', async () => {
    await request(app).post('/api/wine').send({ producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' });
    await request(app).post('/api/wine').send({ producer: 'Opus One', seriesAndName: 'Napa Blend' });

    const res = await request(app).get('/api/wine/search?q=margaux');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].producer).toBe('Chateau Margaux');
  });

  it('matches on the name field too, not just producer', async () => {
    await request(app).post('/api/wine').send({ producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' });

    const res = await request(app).get('/api/wine/search?q=grand vin');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('excludes collectionOnly entries even if they match', async () => {
    await request(app).post('/api/wine').send({ producer: 'Hidden Match', collectionOnly: true });

    const res = await request(app).get('/api/wine/search?q=hidden');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when the search lookup throws', async () => {
    jest.spyOn(db, 'getCollection').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/wine/search?q=x');
    expect(res.status).toBe(500);
    db.getCollection.mockRestore();
  });
});
