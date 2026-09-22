const request = require('supertest');

let app;
let db;

beforeAll(() => {
  jest.resetModules();
  app = require('../index');
  db = require('../db');
});

afterAll(() => jest.resetModules());

beforeEach(() => db.resetFake());

async function seed(category, drinks) {
  await (await db.getCollection(category)).insertMany(drinks);
}

async function all(category) {
  return (await db.getCollection(category)).find({}).toArray();
}

describe('POST /api/:category/cellar', () => {
  it('creates a cellar-only drink with its lot in one call', async () => {
    const res = await request(app).post('/api/wine/cellar')
      .send({ producer: 'Château X', name: 'Reserve', country: 'France', abv: '13', tags: ['gift'], quantity: 2, price: 45.5 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ producer: 'Château X', seriesAndName: 'Reserve', country: 'France', tags: ['gift'], collectionOnly: true });
    expect(res.body.collection).toEqual([expect.objectContaining({ quantity: 2, price: 45.5 })]);
    expect(await all('wine')).toHaveLength(1);
  });

  it('uses the category-specific producer/name keys', async () => {
    const res = await request(app).post('/api/beer/cellar').send({ producer: 'Brew Co', name: 'IPA', quantity: 1 });
    expect(res.body).toMatchObject({ brewery: 'Brew Co', name: 'IPA' });
    expect(res.body.collection[0].price).toBeNull();
  });

  it('an invalid lot leaves no drink behind', async () => {
    for (const quantity of [0, 2.5, undefined]) {
      const res = await request(app).post('/api/wine/cellar').send({ producer: 'P', name: 'N', quantity });
      expect(res.status).toBe(400);
    }
    expect(await all('wine')).toHaveLength(0);
  });

  it('rejects an out-of-range abv without creating anything', async () => {
    const res = await request(app).post('/api/wine/cellar').send({ producer: 'P', name: 'N', abv: '150', quantity: 1 });
    expect(res.status).toBe(400);
    expect(await all('wine')).toHaveLength(0);
  });

  it('attaches the lot to a drink you already reviewed instead of minting a twin', async () => {
    await seed('wine', [{ id: 'reviewed-1', producer: 'דלתון', seriesAndName: "Kna'an Red", collection: [{ id: 'old', quantity: 1, price: null }] }]);
    const res = await request(app).post('/api/wine/cellar').send({ producer: 'דלתון', name: "Kna'an Red", quantity: 3 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('reviewed-1');
    expect(res.body.collectionOnly).toBeUndefined();
    expect(res.body.collection.map(l => l.quantity)).toEqual([1, 3]);
    expect(await all('wine')).toHaveLength(1);
  });

  it('matching ignores case and surrounding whitespace', async () => {
    await seed('wine', [{ id: 'reviewed-1', producer: 'Yatir', seriesAndName: 'Darom' }]);
    const res = await request(app).post('/api/wine/cellar').send({ producer: '  yatir ', name: 'DAROM', quantity: 1 });
    expect(res.body.id).toBe('reviewed-1');
  });

  it('also matches a cellar-only drink whose lots are all drunk', async () => {
    await seed('wine', [{ id: 'c1', producer: 'Yatir', seriesAndName: 'Darom', collectionOnly: true, collection: [{ id: 'l', quantity: 0 }] }]);
    const res = await request(app).post('/api/wine/cellar').send({ producer: 'Yatir', name: 'Darom', quantity: 1 });
    expect(res.body.id).toBe('c1');
  });

  it('a new name under a known producer creates a new drink', async () => {
    await seed('wine', [{ id: 'reviewed-1', producer: 'Yatir', seriesAndName: 'Darom' }]);
    const res = await request(app).post('/api/wine/cellar').send({ producer: 'Yatir', name: 'Reserve', quantity: 1 });
    expect(res.body.id).not.toBe('reviewed-1');
    expect(await all('wine')).toHaveLength(2);
  });

  it('a blank producer or name never matches an existing drink', async () => {
    await seed('wine', [{ id: 'blank', producer: '', seriesAndName: '' }]);
    const res = await request(app).post('/api/wine/cellar').send({ producer: '', name: '', quantity: 1 });
    expect(res.body.id).not.toBe('blank');
  });

  it('treats a missing producer/name as blank and an empty price as no price', async () => {
    await seed('wine', [{ id: 'blank', producer: '', seriesAndName: '' }]);
    const res = await request(app).post('/api/wine/cellar').send({ quantity: 1, price: '' });
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe('blank');
    expect(res.body.collection[0].price).toBeNull();
  });

  it('returns 500 when the data backend fails', async () => {
    const spy = jest.spyOn(db, 'getCollection').mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/wine/cellar').send({ producer: 'P', name: 'N', quantity: 1 });
    spy.mockRestore();
    expect(res.status).toBe(500);
  });

  it('returns 404 for an unknown category', async () => {
    const res = await request(app).post('/api/sake/cellar').send({ producer: 'P', name: 'N', quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/:category/:id/tastings with decrementLotId', () => {
  beforeEach(() => seed('wine', [{ id: 'w1', producer: 'P', seriesAndName: 'N', collection: [{ id: 'lot1', quantity: 2 }, { id: 'lot2', quantity: 5 }] }]));

  it('drinks one bottle from that lot in the same write as the tasting', async () => {
    const res = await request(app).post('/api/wine/w1/tastings').send({ date: '01/09/2026', rating: 8, decrementLotId: 'lot1' });
    expect(res.status).toBe(201);
    expect(res.body.tastings).toHaveLength(1);
    expect(res.body.collection.map(l => l.quantity)).toEqual([1, 5]);
  });

  it('never takes a lot below zero', async () => {
    await (await db.getCollection('wine')).deleteMany({});
    await seed('wine', [{ id: 'w1', collection: [{ id: 'lot1', quantity: 0 }] }]);
    const res = await request(app).post('/api/wine/w1/tastings').send({ date: '01/09/2026', rating: 8, decrementLotId: 'lot1' });
    expect(res.body.collection[0].quantity).toBe(0);
  });

  it('ignores decrementLotId on a drink with no lots', async () => {
    await seed('wine', [{ id: 'w2', producer: 'Q', seriesAndName: 'R' }]);
    const res = await request(app).post('/api/wine/w2/tastings').send({ date: '01/09/2026', rating: 8, decrementLotId: 'lot1' });
    expect(res.status).toBe(201);
    expect(res.body.collection).toBeUndefined();
  });

  it('ignores an unknown lot id and still saves the tasting', async () => {
    const res = await request(app).post('/api/wine/w1/tastings').send({ date: '01/09/2026', rating: 8, decrementLotId: 'nope' });
    expect(res.status).toBe(201);
    expect(res.body.tastings).toHaveLength(1);
    expect(res.body.collection.map(l => l.quantity)).toEqual([2, 5]);
  });
});
