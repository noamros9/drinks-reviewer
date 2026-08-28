let db;
let geocoding;

beforeEach(() => {
  jest.resetModules();
  db = require('../db');
  geocoding = require('../geocoding');
  db.resetFake();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetModules();
  delete global.fetch;
});

describe('ensureRegionCoordinates', () => {

  // A nested region is a path, not a place name: searching for the whole path finds
  // nothing, so only the most specific segment goes to Nominatim.
  it('searches Nominatim for the leaf but caches under the full path', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '47.3', lon: '2.8' }]),
    });
    await geocoding.ensureRegionCoordinates('France', 'Loire Valley / Sancerre');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain(encodeURIComponent('Sancerre, France'));
    expect(url).not.toContain(encodeURIComponent('Loire Valley / Sancerre'));
    await expect(geocoding.readCoordinates()).resolves.toEqual({
      'France||Loire Valley / Sancerre': { lat: 47.3, lon: 2.8 },
    });
  });

  it('gives sibling appellations their own cache entries', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '1', lon: '2' }]),
    });
    await geocoding.ensureRegionCoordinates('Italy', 'Toscana / Chianti');
    await geocoding.ensureRegionCoordinates('Italy', 'Toscana / Bolgheri');
    expect(Object.keys(await geocoding.readCoordinates()).sort())
      .toEqual(['Italy||Toscana / Bolgheri', 'Italy||Toscana / Chianti']);
  });
  it('does nothing when country or region is missing', async () => {
    await geocoding.ensureRegionCoordinates('', 'Rioja');
    await geocoding.ensureRegionCoordinates('Spain', '');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls Nominatim and caches the result on a cache miss', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '42.4', lon: '-2.4' }]),
    });
    await geocoding.ensureRegionCoordinates('Spain', 'Rioja');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('nominatim.openstreetmap.org');
    expect(opts.headers['User-Agent']).toMatch(/drinks-reviewer/);
    expect(await geocoding.readCoordinates()).toEqual({ 'Spain||Rioja': { lat: 42.4, lon: -2.4 } });
  });

  it('skips the network call on a cache hit', async () => {
    const col = await db.getRegionCoordinatesCollection();
    await col.insertMany([{ _id: 'Spain||Rioja', lat: 1, lon: 2 }]);
    await geocoding.ensureRegionCoordinates('Spain', 'Rioja');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves the cache untouched when Nominatim returns a non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    await geocoding.ensureRegionCoordinates('Spain', 'Rioja');
    expect(await geocoding.readCoordinates()).toEqual({});
  });

  it('leaves the cache untouched when Nominatim returns no matches', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    await geocoding.ensureRegionCoordinates('Nowhere', 'Madeupistan');
    expect(await geocoding.readCoordinates()).toEqual({});
  });

  it('swallows a network failure without throwing', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    await expect(geocoding.ensureRegionCoordinates('Spain', 'Rioja')).resolves.toBeUndefined();
    expect(await geocoding.readCoordinates()).toEqual({});
  });
});

describe('readCoordinates', () => {
  it('returns {} when nothing has been geocoded yet', async () => {
    expect(await geocoding.readCoordinates()).toEqual({});
  });

  it('returns the cached coordinates', async () => {
    const col = await db.getRegionCoordinatesCollection();
    await col.insertMany([{ _id: 'Spain||Rioja', lat: 1, lon: 2 }]);
    expect(await geocoding.readCoordinates()).toEqual({ 'Spain||Rioja': { lat: 1, lon: 2 } });
  });
});
