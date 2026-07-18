const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../cloudinary', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../dataStore', () => ({
  ...jest.requireActual('../dataStore'),
  writeData: jest.fn((...args) => jest.requireActual('../dataStore').writeData(...args)),
}));

let app;
let db;
let cloudinary;
let dataStore;
let tmpDir;
let uploadCount;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drinks-image-ordering-test-'));
  process.env.DATA_DIR = tmpDir;
  jest.resetModules();
  app = require('../index');
  db = require('../db');
  cloudinary = require('../cloudinary');
  dataStore = require('../dataStore');
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
  dataStore.writeData.mockImplementation((...args) => jest.requireActual('../dataStore').writeData(...args));
});

async function createDrink(category = 'wine', body = { producer: 'Test' }) {
  const res = await request(app).post(`/api/${category}`).send(body);
  return res.body;
}

test('collection image: old photo survives a failed writeData instead of being deleted first', async () => {
  const drink = await createDrink();
  const first = await request(app)
    .post(`/api/wine/${drink.id}/collection/image`)
    .attach('image', Buffer.from('fake'), 'a.png');
  const oldUrl = first.body.collectionImageUrl;

  dataStore.writeData.mockRejectedValueOnce(new Error('db down'));
  const res = await request(app)
    .post(`/api/wine/${drink.id}/collection/image`)
    .attach('image', Buffer.from('fake2'), 'b.png');

  expect(res.status).toBe(500);
  expect(cloudinary.deleteImage).not.toHaveBeenCalledWith(oldUrl);
});

test('tasting image: old photo survives a failed writeData instead of being deleted first', async () => {
  const drink = await createDrink();
  const tastingRes = await request(app).post(`/api/wine/${drink.id}/tastings`).send({ date: '2026-01-01', rating: 8 });
  const tastingId = tastingRes.body.tastings[0].id;

  const first = await request(app)
    .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
    .attach('image', Buffer.from('fake'), 'a.png');
  const oldUrl = first.body.tastings[0].imageUrl;

  dataStore.writeData.mockRejectedValueOnce(new Error('db down'));
  const res = await request(app)
    .post(`/api/wine/${drink.id}/tastings/${tastingId}/image`)
    .attach('image', Buffer.from('fake2'), 'b.png');

  expect(res.status).toBe(500);
  expect(cloudinary.deleteImage).not.toHaveBeenCalledWith(oldUrl);
});
