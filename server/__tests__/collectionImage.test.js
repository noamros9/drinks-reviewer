const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../cloudinary', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

let app;
let db;
let cloudinary;
let tmpDir;
let uploadCount;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-collection-image-test-'));
  process.env.DATA_DIR = tmpDir;
  jest.resetModules();
  app = require('../index');
  db = require('../db');
  cloudinary = require('../cloudinary');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.DATA_DIR;
  jest.resetModules();
});

beforeEach(() => {
  db.resetFake();
  uploadCount = 0;
  cloudinary.uploadImage.mockImplementation(() => Promise.resolve(`https://res.cloudinary.com/demo/image/upload/v1/drinks/img${++uploadCount}.png`));
  cloudinary.deleteImage.mockClear();
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
    expect(res.body.collectionImageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
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

  it('returns 404 and cleans up the uploaded image when drink is not found', async () => {
    const res = await request(app)
      .post('/api/wine/nonexistent/collection/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
    expect(cloudinary.deleteImage).toHaveBeenCalledWith('https://res.cloudinary.com/demo/image/upload/v1/drinks/img1.png');
  });

  it('returns 500 and cleans up the uploaded image when data is corrupt', async () => {
    const getCollectionSpy = jest.spyOn(db, 'getCollection').mockRejectedValue(new Error('boom'));
    const res = await request(app)
      .post('/api/wine/any/collection/image')
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
    expect(cloudinary.deleteImage).toHaveBeenCalledWith('https://res.cloudinary.com/demo/image/upload/v1/drinks/img1.png');
    getCollectionSpy.mockRestore();
  });

  it('returns 500 when the Cloudinary upload itself fails', async () => {
    cloudinary.uploadImage.mockRejectedValueOnce(new Error('upload boom'));
    const drink = await createDrink('wine');
    const res = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
  });

  it('deletes the old collection image when uploading a new one and nothing else references it', async () => {
    const drink = await createDrink('wine');
    const first = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('img1'), { filename: 'a.jpg', contentType: 'image/jpeg' });
    const second = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('img2'), { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(second.status).toBe(200);
    expect(cloudinary.deleteImage).toHaveBeenCalledWith(first.body.collectionImageUrl);
    expect(second.body.collectionImageUrl).not.toBe(first.body.collectionImageUrl);
  });

  it('keeps the old collection image when a tasting still references it', async () => {
    const drink = await createDrink('wine');
    const first = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('shared'), { filename: 'shared.jpg', contentType: 'image/jpeg' });
    const sharedImageUrl = first.body.collectionImageUrl;

    // First tasting inherits the collectionImageUrl (see tastings tests), so it now references the same URL.
    await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });

    const second = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('new'), { filename: 'new.jpg', contentType: 'image/jpeg' });
    expect(second.status).toBe(200);
    expect(cloudinary.deleteImage).not.toHaveBeenCalledWith(sharedImageUrl);
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
  it('does not delete the shared image when replacing a tasting image inherited from collectionImageUrl', async () => {
    const drink = await createDrink('wine');
    const imgRes = await request(app)
      .post(`/api/wine/${drink.id}/collection/image`)
      .attach('image', Buffer.from('cover'), { filename: 'cover.jpg', contentType: 'image/jpeg' });
    const collectionImageUrl = imgRes.body.collectionImageUrl;

    const addRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '01/01/2025', rating: 8 });
    const tastingId = addRes.body.tastings[0].id;
    expect(addRes.body.tastings[0].imageUrl).toBe(collectionImageUrl);

    const res = await request(app)
      .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
      .attach('image', Buffer.from('new'), { filename: 'new.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(cloudinary.deleteImage).not.toHaveBeenCalledWith(collectionImageUrl);
    expect(res.body.tastings[0].imageUrl).not.toBe(collectionImageUrl);
  });
});
