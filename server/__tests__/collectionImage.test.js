const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

let app;
let db;
let tmpDir;
let imgDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-collection-image-test-'));
  imgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-collection-image-img-'));
  process.env.DATA_DIR = tmpDir;
  process.env.IMAGES_DIR = imgDir;
  jest.resetModules();
  app = require('../index');
  db = require('../db');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
  fs.rmSync(imgDir, { recursive: true });
  delete process.env.DATA_DIR;
  delete process.env.IMAGES_DIR;
  jest.resetModules();
});

beforeEach(() => {
  db.resetFake();
});

async function createDrink(category = 'wine', body = { producer: 'Test' }) {
  const res = await request(app).post(`/api/${category}`).send(body);
  return res.body;
}

describe('POST /api/:category/:id/collection/image', () => {
  it('saves the uploaded image and sets collectionImageUrl', async () => {
    const drink = await createDrink('wine');
    const res = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('fakepng'), { filename: 'bottle.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.collectionImageUrl).toMatch(/^\/images\/drinks\/.+\.png$/);
    expect(fs.existsSync(path.join(imgDir, path.basename(res.body.collectionImageUrl)))).toBe(true);
  });

  it('returns 400 when no file is attached', async () => {
    const drink = await createDrink('wine');
    const res = await request(app).post(`/api/wine/${drink.id}/collection/image`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown category', async () => {
    const res = await request(app)
      .post('/api/nope/abc/collection/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns 404 and cleans up uploaded file when drink is not found', async () => {
    const filesBefore = fs.readdirSync(imgDir).length;
    const res = await request(app)
      .post('/api/wine/nonexistent/collection/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
    expect(fs.readdirSync(imgDir).length).toBe(filesBefore);
  });

  it('returns 500 and cleans up uploaded file when data is corrupt', async () => {
    const filesBefore = fs.readdirSync(imgDir).length;
    const getCollectionSpy = jest.spyOn(db, 'getCollection').mockRejectedValue(new Error('boom'));
    const res = await request(app)
      .post('/api/wine/any/collection/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
    expect(fs.readdirSync(imgDir).length).toBe(filesBefore);
    getCollectionSpy.mockRestore();
  });

  it('replaces old collection image file when uploading a new one and nothing else references it', async () => {
    const drink = await createDrink('wine');
    const first = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('img1'), { filename: 'a.jpg', contentType: 'image/jpeg' });
    const firstFile = path.join(imgDir, path.basename(first.body.collectionImageUrl));
    const second = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('img2'), { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(second.status).toBe(200);
    expect(fs.existsSync(firstFile)).toBe(false);
    expect(second.body.collectionImageUrl).not.toBe(first.body.collectionImageUrl);
  });

  it('keeps the old collection image file on disk when a tasting still references it', async () => {
    const drink = await createDrink('wine');
    const first = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('shared'), { filename: 'shared.jpg', contentType: 'image/jpeg' });
    const sharedImageUrl = first.body.collectionImageUrl;
    const sharedFile = path.join(imgDir, path.basename(sharedImageUrl));

    // First tasting inherits the collectionImageUrl (see tastings tests), so it now references the same file.
    await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });

    const second = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('new'), { filename: 'new.jpg', contentType: 'image/jpeg' });
    expect(second.status).toBe(200);
    expect(fs.existsSync(sharedFile)).toBe(true);
    expect(second.body.collectionImageUrl).not.toBe(sharedImageUrl);
  });
});

describe('POST /api/:category/:id/tastings collectionImageUrl inheritance', () => {
  it('a first tasting inherits collectionImageUrl when the drink has one and no prior tastings', async () => {
    const drink = await createDrink('wine');
    const imgRes = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('cover'), { filename: 'cover.jpg', contentType: 'image/jpeg' });
    const collectionImageUrl = imgRes.body.collectionImageUrl;

    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    expect(res.status).toBe(201);
    expect(res.body.tastings[0].imageUrl).toBe(collectionImageUrl);
  });

  it('a second tasting does not fall back to collectionImageUrl when the first tasting had no image', async () => {
    const drink = await createDrink('wine');
    // First tasting is added before any collectionImageUrl exists, so it gets no imageUrl.
    await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    // collectionImageUrl is only set afterwards, once the drink already has a tasting.
    await request(app).post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('cover'), { filename: 'cover.jpg', contentType: 'image/jpeg' });

    const res = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '02/02/2025', rating: 9 });
    expect(res.status).toBe(201);
    expect(res.body.tastings[1].imageUrl).toBeUndefined();
  });
});

describe('POST /api/:category/:id/tastings/:tastingId/image collectionImageUrl protection', () => {
  it('does not delete the shared file from disk when replacing a tasting image inherited from collectionImageUrl', async () => {
    const drink = await createDrink('wine');
    const imgRes = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('cover'), { filename: 'cover.jpg', contentType: 'image/jpeg' });
    const collectionImageUrl = imgRes.body.collectionImageUrl;
    const sharedFile = path.join(imgDir, path.basename(collectionImageUrl));

    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    expect(addRes.body.tastings[0].imageUrl).toBe(collectionImageUrl);

    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('new'), { filename: 'new.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(fs.existsSync(sharedFile)).toBe(true);
    expect(res.body.tastings[0].imageUrl).not.toBe(collectionImageUrl);
  });
});
