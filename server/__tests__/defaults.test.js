// Two purposes:
// 1. Load app without DATA_DIR/IMAGES_DIR to cover the || fallback branches in drinks.js constants
// 2. Unit-test withLock concurrency (the while body is only reachable with an async fn())
let app;
let drinksRouter;

beforeAll(() => {
  delete process.env.DATA_DIR;
  delete process.env.IMAGES_DIR;
  jest.resetModules();
  app = require('../index');
  drinksRouter = require('../routes/drinks');
});

afterAll(() => {
  jest.resetModules();
});

it('loads and responds when using default data/images directories', async () => {
  const request = require('supertest');
  const res = await request(app).get('/api/wine');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

it('withLock queues concurrent callers (covers while body)', async () => {
  const withLock = drinksRouter._withLock;
  let releaseFirst;
  const firstHeld = new Promise(r => { releaseFirst = r; });
  const order = [];

  const first = withLock('testcat', async () => { await firstHeld; order.push('first'); });
  const second = withLock('testcat', async () => { order.push('second'); });

  releaseFirst();
  await Promise.all([first, second]);
  expect(order).toEqual(['first', 'second']);
});
