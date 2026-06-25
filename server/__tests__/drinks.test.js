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
});
