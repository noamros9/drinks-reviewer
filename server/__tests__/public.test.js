const request = require('supertest');

jest.mock('../cloudinary', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/v1/drinks/fake.png'),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

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

describe('GET /api/public/catalog', () => {
  it('returns 404 when the catalog is not public', async () => {
    const res = await request(app).get('/api/public/catalog');
    expect(res.status).toBe(404);
  });

  it('returns curated fields for reviewed drinks once public, excluding collectionOnly entries', async () => {
    await request(app).patch('/api/settings').send({ catalogPublic: true });
    const wine = await request(app).post('/api/wine').send({ producer: 'Chateau X', seriesAndName: 'Reserve' });
    await request(app).put(`/api/wine/${wine.body.id}`).send({ producer: 'Chateau X', seriesAndName: 'Reserve', collectionOnly: true });
    await request(app).post('/api/beer').send({ brewery: 'Brew Co', name: 'IPA' });

    const res = await request(app).get('/api/public/catalog');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      id: expect.any(String), category: 'beer', producer: 'Brew Co', name: 'IPA',
      avgRating: null, tastingCount: 0, tastings: [], photo: null,
    }]);
  });

  it('returns 500 when the data backend fails', async () => {
    const spy = jest.spyOn(db, 'getSettingsCollection').mockRejectedValue(new Error('boom'));
    expect((await request(app).get('/api/public/catalog')).status).toBe(500);
    spy.mockRestore();
  });
});

describe('GET /api/public/:category/:id', () => {
  it('returns 404 for an unshared drink', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    const res = await request(app).get(`/api/public/wine/${wine.body.id}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown category', async () => {
    const res = await request(app).get('/api/public/spirits/some-id');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app).patch('/api/wine/nope/share').send({ shared: true });
    expect(res.status).toBe(404);
    const res2 = await request(app).get('/api/public/wine/nope');
    expect(res2.status).toBe(404);
  });

  it('returns curated fields for a shared drink, including tastings and photo', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'Chateau X', seriesAndName: 'Reserve' });
    await request(app).post(`/api/wine/${wine.body.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    await request(app).patch(`/api/wine/${wine.body.id}/share`).send({ shared: true });

    const res = await request(app).get(`/api/public/wine/${wine.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: wine.body.id, category: 'wine', producer: 'Chateau X', name: 'Reserve',
      avgRating: 8, tastingCount: 1, tastings: [{ date: '01/01/2025', rating: 8, imageUrl: null }], photo: null,
    });
  });

  it('returns 404 again once unshared', async () => {
    const wine = await request(app).post('/api/wine').send({ producer: 'X' });
    await request(app).patch(`/api/wine/${wine.body.id}/share`).send({ shared: true });
    await request(app).patch(`/api/wine/${wine.body.id}/share`).send({ shared: false });
    const res = await request(app).get(`/api/public/wine/${wine.body.id}`);
    expect(res.status).toBe(404);
  });

  it('returns 500 when the data backend fails', async () => {
    const spy = jest.spyOn(db, 'getCollection').mockRejectedValue(new Error('boom'));
    expect((await request(app).get('/api/public/wine/any-id')).status).toBe(500);
    spy.mockRestore();
  });
});
