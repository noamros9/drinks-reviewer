const request = require('supertest');

let app;
let db;

beforeAll(() => {
  jest.resetModules();
  app = require('../index');
  db = require('../db');
});

afterAll(() => {
  jest.resetModules();
});

beforeEach(() => {
  db.resetFake();
});

async function createDrink(category = 'wine', body = { producer: 'Test' }) {
  const res = await request(app).post(`/api/${category}`).send(body);
  return res.body;
}

describe('PATCH /api/:category/bulk', () => {
  it('overwrites a scalar field across multiple entries', async () => {
    const a = await createDrink('wine', { producer: 'A', region: 'Old' });
    const b = await createDrink('wine', { producer: 'B', region: 'Old' });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id, b.id], field: 'region', value: 'Bordeaux' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toHaveLength(2);
    expect(res.body.updated.every(d => d.region === 'Bordeaux')).toBe(true);

    const list = (await request(app).get('/api/wine')).body;
    expect(list.find(d => d.id === a.id).region).toBe('Bordeaux');
    expect(list.find(d => d.id === b.id).region).toBe('Bordeaux');
  });

  it('adds a tag to multiple entries, deduping if already present', async () => {
    const a = await createDrink('wine', { producer: 'A', tags: ['gift'] });
    const b = await createDrink('wine', { producer: 'B', tags: [] });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id, b.id], field: 'tags', value: 'gift', tagAction: 'add' });
    expect(res.status).toBe(200);
    expect(res.body.updated.find(d => d.id === a.id).tags).toEqual(['gift']);
    expect(res.body.updated.find(d => d.id === b.id).tags).toEqual(['gift']);
  });

  it('removes a tag from multiple entries', async () => {
    const a = await createDrink('wine', { producer: 'A', tags: ['gift', 'organic'] });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id], field: 'tags', value: 'gift', tagAction: 'remove' });
    expect(res.status).toBe(200);
    expect(res.body.updated[0].tags).toEqual(['organic']);
  });

  it('normalizes tag case so a mixed-case add does not create a duplicate', async () => {
    const a = await createDrink('wine', { producer: 'A', tags: ['gift'] });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id], field: 'tags', value: 'Gift', tagAction: 'add' });
    expect(res.status).toBe(200);
    expect(res.body.updated[0].tags).toEqual(['gift']);
  });

  it('adds a variety without lowercasing it (proper grape name, not a tag)', async () => {
    const a = await createDrink('wine', { producer: 'A', variety: [] });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id], field: 'variety', value: 'Merlot', tagAction: 'add' });
    expect(res.status).toBe(200);
    expect(res.body.updated[0].variety).toEqual(['Merlot']);
  });

  it('does not modify entries not included in ids', async () => {
    const a = await createDrink('wine', { producer: 'A', region: 'Old' });
    const b = await createDrink('wine', { producer: 'B', region: 'Old' });
    await request(app).patch('/api/wine/bulk').send({ ids: [a.id], field: 'region', value: 'Bordeaux' });
    const list = (await request(app).get('/api/wine')).body;
    expect(list.find(d => d.id === b.id).region).toBe('Old');
  });

  it('adds a tag to a legacy entry with no tags property (covers tags || [] fallback)', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const col = await db.getCollection('wine');
    const data = await col.find({}, { projection: { _id: 0 } }).toArray();
    delete data.find(d => d.id === a.id).tags;
    await col.deleteMany({});
    await col.insertMany(data);

    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id], field: 'tags', value: 'gift', tagAction: 'add' });
    expect(res.status).toBe(200);
    expect(res.body.updated[0].tags).toEqual(['gift']);
  });

  it('silently skips ids that do not belong to this category', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id, 'nonexistent-id'], field: 'region', value: 'Bordeaux' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toHaveLength(1);
    expect(res.body.updated[0].id).toBe(a.id);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).patch('/api/nope/bulk').send({ ids: ['x'], field: 'region', value: 'Y' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when ids is missing', async () => {
    const res = await request(app).patch('/api/wine/bulk').send({ field: 'region', value: 'Y' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ids is an empty array', async () => {
    const res = await request(app).patch('/api/wine/bulk').send({ ids: [], field: 'region', value: 'Y' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when field is not bulk-editable', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app).patch('/api/wine/bulk').send({ ids: [a.id], field: 'producer', value: 'Y' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when field is not in ALLOWED_FIELDS for the category (e.g. wine-only field on beer)', async () => {
    const a = await createDrink('beer', { brewery: 'A' });
    const res = await request(app).patch('/api/beer/bulk').send({ ids: [a.id], field: 'variety', value: 'Y' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when field is tags but tagAction is missing', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app).patch('/api/wine/bulk').send({ ids: [a.id], field: 'tags', value: 'gift' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when field is tags but tagAction is invalid', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app).patch('/api/wine/bulk').send({ ids: [a.id], field: 'tags', value: 'gift', tagAction: 'nope' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when tagAction is present for a non-tags field', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app)
      .patch('/api/wine/bulk')
      .send({ ids: [a.id], field: 'region', value: 'Bordeaux', tagAction: 'add' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when value is missing', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app).patch('/api/wine/bulk').send({ ids: [a.id], field: 'region' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when value is an empty string', async () => {
    const a = await createDrink('wine', { producer: 'A' });
    const res = await request(app).patch('/api/wine/bulk').send({ ids: [a.id], field: 'region', value: '' });
    expect(res.status).toBe(400);
  });
});
