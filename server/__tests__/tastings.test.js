const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { computeFromTastings } = require('../tastingsHelper');

let app;
let tmpDir;
let imgDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-tasting-test-'));
  imgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-img-test-'));
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    fs.writeFileSync(path.join(tmpDir, `${cat}.json`), '[]');
  });
  process.env.DATA_DIR = tmpDir;
  process.env.IMAGES_DIR = imgDir;
  jest.resetModules();
  app = require('../index');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
  fs.rmSync(imgDir, { recursive: true });
  delete process.env.DATA_DIR;
  delete process.env.IMAGES_DIR;
  jest.resetModules();
});

beforeEach(() => {
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    fs.writeFileSync(path.join(tmpDir, `${cat}.json`), '[]');
  });
});

async function createDrink(category = 'wine', body = { producer: 'Test' }) {
  const res = await request(app).post(`/api/${category}`).send(body);
  return res.body;
}

describe('POST /api/:category/:id/tastings', () => {
  it('appends a tasting and recomputes derived fields', async () => {
    const drink = await createDrink('wine');
    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings`)
      .send({ date: '15/03/2025', rating: 8, vintage: '2021' });
    expect(res.status).toBe(201);
    expect(res.body.tastings).toHaveLength(1);
    expect(res.body.tastings[0].date).toBe('15/03/2025');
    expect(res.body.tastings[0].rating).toBe(8);
    expect(res.body.tastings[0].vintage).toBe('2021');
    expect(res.body.lastRating).toBe(8);
    expect(res.body.avgRating).toBe(8);
    expect(res.body.lastTasted).toBe('15/03/2025');
    expect(res.body.tastingCount).toBe(1);
  });

  it('averages multiple tastings correctly', async () => {
    const drink = await createDrink('wine');
    await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7 });
    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/06/2025', rating: 9 });
    expect(res.body.avgRating).toBe(8);
    expect(res.body.lastRating).toBe(9);
    expect(res.body.tastingCount).toBe(2);
  });

  it('returns 400 when date is missing', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ rating: 7 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is missing', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is below 1', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is above 10', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 11 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).post('/api/nope/abc/tastings').send({ date: '01/01/2025', rating: 7 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown drink id', async () => {
    const res = await request(app).post('/api/wine/nonexistent/tastings').send({ date: '01/01/2025', rating: 7 });
    expect(res.status).toBe(404);
  });

  it('works for non-wine category without vintage', async () => {
    const drink = await createDrink('beer', { brewery: 'BrewCo', name: 'Lager' });
    const res = await request(app)
      .post(`/api/beer/${drink.id}/tastings`)
      .send({ date: '10/05/2025', rating: 7.5 });
    expect(res.status).toBe(201);
    expect(res.body.tastings[0].vintage).toBeUndefined();
  });

  it('first tasting has no imageUrl (nothing to carry over)', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    expect(res.body.tastings[0].imageUrl).toBeUndefined();
  });

  it('carries the previous tasting\'s photo over to a new tasting added without one', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    const imgRes = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('fakepng'), { filename: 'bottle.png', contentType: 'image/png' });
    const imageUrl = imgRes.body.tastings[0].imageUrl;

    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '02/02/2025', rating: 9 });
    expect(res.body.tastings).toHaveLength(2);
    expect(res.body.tastings[0].imageUrl).toBe(imageUrl);
    expect(res.body.tastings[1].imageUrl).toBe(imageUrl);
  });
});

describe('DELETE /api/:category/:id/tastings/:tastingId', () => {
  it('returns 404 for unknown category', async () => {
    const res = await request(app).delete('/api/nope/abc/tastings/xyz');
    expect(res.status).toBe(404);
  });

  it('returns 404 when drink has no tastings property (covers tastings || [] branches)', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).delete(`/api/wine/${drink.id}/tastings/nonexistent-id`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tasting not found');
  });

  it('removes tasting and recomputes derived fields', async () => {
    const drink = await createDrink('wine');
    const add1 = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7 });
    await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/06/2025', rating: 9 });
    const tastingIdToRemove = add1.body.tastings[0].id;
    const res = await request(app).delete(`/api/wine/${drink.id}/tastings/${tastingIdToRemove}`);
    expect(res.status).toBe(200);
    expect(res.body.tastings).toHaveLength(1);
    expect(res.body.avgRating).toBe(9);
    expect(res.body.tastingCount).toBe(1);
  });

  it('clears derived tasting fields when the last tasting is deleted', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7, vintage: '2020' });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app).delete(`/api/wine/${drink.id}/tastings/${tastingId}`);
    expect(res.status).toBe(200);
    expect(res.body.avgRating).toBeUndefined();
    expect(res.body.lastRating).toBeUndefined();
    expect(res.body.lastTasted).toBeUndefined();
    expect(res.body.tastingCount).toBeUndefined();
    expect(res.body.vintage).toBeUndefined();
  });

  it('returns 404 for unknown tasting id', async () => {
    const drink = await createDrink('wine');
    await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7 });
    const res = await request(app).delete(`/api/wine/${drink.id}/tastings/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown drink id', async () => {
    const res = await request(app).delete('/api/wine/nonexistent/tastings/abc');
    expect(res.status).toBe(404);
  });
});

describe('computeFromTastings', () => {
  it('returns empty object for empty array', () => {
    expect(computeFromTastings([], true)).toEqual({});
  });

  it('returns empty object for null', () => {
    expect(computeFromTastings(null, true)).toEqual({});
  });

  it('computes correct fields from single tasting', () => {
    const result = computeFromTastings([{ id: 'a', date: '15/03/2025', rating: 8.5, vintage: '2021' }], true);
    expect(result.avgRating).toBe(8.5);
    expect(result.lastRating).toBe(8.5);
    expect(result.lastTasted).toBe('15/03/2025');
    expect(result.tastingCount).toBe(1);
    expect(result.vintage).toBe('2021');
  });

  it('picks last vintage for wine', () => {
    const tastings = [
      { id: 'a', date: '01/01/2023', rating: 7, vintage: '2019' },
      { id: 'b', date: '01/01/2024', rating: 8, vintage: '2021' },
    ];
    const result = computeFromTastings(tastings, true);
    expect(result.vintage).toBe('2021');
  });

  it('does not include vintage for non-wine', () => {
    const result = computeFromTastings([{ id: 'a', date: '01/01/2024', rating: 7 }], false);
    expect(result.vintage).toBeUndefined();
  });

  it('rounds avgRating to 2 decimal places', () => {
    const tastings = [
      { id: 'a', date: '01/01/2023', rating: 7 },
      { id: 'b', date: '01/06/2023', rating: 8 },
      { id: 'c', date: '01/01/2024', rating: 8 },
    ];
    const result = computeFromTastings(tastings, false);
    expect(result.avgRating).toBe(7.67);
  });
});

describe('POST /api/:category/:id/tastings/:tastingId/image', () => {
  it('saves the uploaded image and updates imageUrl on the tasting', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('fakepng'), { filename: 'bottle.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.tastings[0].imageUrl).toMatch(/^\/images\/drinks\/.+\.png$/);
    expect(fs.existsSync(path.join(imgDir, path.basename(res.body.tastings[0].imageUrl)))).toBe(true);
  });

  it('replaces old image file when uploading a new one', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    const first = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('img1'), { filename: 'a.jpg', contentType: 'image/jpeg' });
    const firstFile = path.join(imgDir, path.basename(first.body.tastings[0].imageUrl));
    const second = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('img2'), { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(second.status).toBe(200);
    expect(fs.existsSync(firstFile)).toBe(false);
    expect(second.body.tastings[0].imageUrl).not.toBe(first.body.tastings[0].imageUrl);
  });

  it('keeps the image file when another tasting still references it (carry-forward)', async () => {
    const drink = await createDrink('wine');
    const addRes1 = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId1 = addRes1.body.tastings[0].id;
    const uploadRes = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId1}/image`)
      .attach('image', Buffer.from('shared'), { filename: 'shared.jpg', contentType: 'image/jpeg' });
    const sharedImageUrl = uploadRes.body.tastings[0].imageUrl;
    const sharedFile = path.join(imgDir, path.basename(sharedImageUrl));

    const addRes2 = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '02/01/2025', rating: 7, imageUrl: sharedImageUrl });
    const tastingId2 = addRes2.body.tastings.find(t => t.id !== tastingId1).id;

    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId1}/image`)
      .attach('image', Buffer.from('new'), { filename: 'new.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(fs.existsSync(sharedFile)).toBe(true);
    expect(res.body.tastings.find(t => t.id === tastingId2).imageUrl).toBe(sharedImageUrl);
  });

  it('returns 400 when no file is attached', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app).post(`/api/wine/${drink.id}/tastings/${tastingId}/image`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app)
      .post('/api/nope/abc/tastings/xyz/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown drink id', async () => {
    const res = await request(app)
      .post('/api/wine/nonexistent/tastings/xyz/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown tasting id', async () => {
    const drink = await createDrink('wine');
    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/nonexistent/image`)
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns 400 and rejects non-image file types', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('<html>xss</html>'), { filename: 'shell.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
  });

  it('cleans up uploaded file when drink is not found', async () => {
    const filesBefore = fs.readdirSync(imgDir).length;
    const res = await request(app)
      .post('/api/wine/nonexistent/tastings/xyz/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
    expect(fs.readdirSync(imgDir).length).toBe(filesBefore);
  });

  it('cleans up uploaded file when tasting is not found', async () => {
    const drink = await createDrink('wine');
    const filesBefore = fs.readdirSync(imgDir).length;
    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/nonexistent/image`)
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
    expect(fs.readdirSync(imgDir).length).toBe(filesBefore);
  });

  it('returns 500 and cleans up uploaded file when data is corrupt', async () => {
    const filesBefore = fs.readdirSync(imgDir).length;
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), 'INVALID');
    const res = await request(app)
      .post('/api/wine/any/tastings/any/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
    expect(fs.readdirSync(imgDir).length).toBe(filesBefore);
    fs.writeFileSync(path.join(tmpDir, 'wine.json'), '[]');
  });
});

describe('PUT /api/:category/:id/tastings/:tastingId', () => {
  it('updates date, rating, and vintage and recomputes derived fields', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7, vintage: '2020' });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app)
      .put(`/api/wine/${drink.id}/tastings/${tastingId}`)
      .send({ date: '15/03/2025', rating: 9, vintage: '2021' });
    expect(res.status).toBe(200);
    expect(res.body.tastings[0].date).toBe('15/03/2025');
    expect(res.body.tastings[0].rating).toBe(9);
    expect(res.body.tastings[0].vintage).toBe('2021');
    expect(res.body.lastRating).toBe(9);
    expect(res.body.avgRating).toBe(9);
  });

  it('clears vintage when updated wine tasting has no vintage (covers vintage || undefined branch)', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7, vintage: '2020' });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app)
      .put(`/api/wine/${drink.id}/tastings/${tastingId}`)
      .send({ date: '01/01/2024', rating: 7 });
    expect(res.status).toBe(200);
    expect(res.body.tastings[0].vintage).toBeUndefined();
  });

  it('works for non-wine category (covers if category===wine false branch)', async () => {
    const drink = await createDrink('beer', { brewery: 'BrewCo', name: 'Lager' });
    const addRes = await request(app).post(`/api/beer/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7 });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app)
      .put(`/api/beer/${drink.id}/tastings/${tastingId}`)
      .send({ date: '15/03/2025', rating: 8 });
    expect(res.status).toBe(200);
    expect(res.body.tastings[0].vintage).toBeUndefined();
  });

  it('returns 400 when date is missing', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7 });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app).put(`/api/wine/${drink.id}/tastings/${tastingId}`).send({ rating: 7 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when updated rating is out of range', async () => {
    const drink = await createDrink('wine');
    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2024', rating: 7 });
    const tastingId = addRes.body.tastings[0].id;
    const res = await request(app).put(`/api/wine/${drink.id}/tastings/${tastingId}`).send({ date: '01/01/2024', rating: 11 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app).put('/api/nope/abc/tastings/xyz').send({ date: '01/01/2025', rating: 7 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown drink id', async () => {
    const res = await request(app).put('/api/wine/nonexistent/tastings/xyz').send({ date: '01/01/2025', rating: 7 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown tasting id', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).put(`/api/wine/${drink.id}/tastings/nonexistent`).send({ date: '01/01/2025', rating: 7 });
    expect(res.status).toBe(404);
  });
});
