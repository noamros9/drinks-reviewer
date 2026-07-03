const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let geocoding;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geocoding-test-'));
  process.env.DATA_DIR = tmpDir;
  jest.resetModules();
  geocoding = require('../geocoding');
  global.fetch = jest.fn();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.DATA_DIR;
  jest.resetModules();
  delete global.fetch;
});

function coordsFile() {
  return geocoding.readCoordinates();
}

describe('ensureRegionCoordinates', () => {
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
    expect(coordsFile()).toEqual({ 'Spain||Rioja': { lat: 42.4, lon: -2.4 } });
  });

  it('skips the network call on a cache hit', async () => {
    fs.writeFileSync(path.join(tmpDir, 'region-coordinates.json'), JSON.stringify({ 'Spain||Rioja': { lat: 1, lon: 2 } }));
    await geocoding.ensureRegionCoordinates('Spain', 'Rioja');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves the cache untouched when Nominatim returns a non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    await geocoding.ensureRegionCoordinates('Spain', 'Rioja');
    expect(coordsFile()).toEqual({});
  });

  it('leaves the cache untouched when Nominatim returns no matches', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    await geocoding.ensureRegionCoordinates('Nowhere', 'Madeupistan');
    expect(coordsFile()).toEqual({});
  });

  it('swallows a network failure without throwing', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    await expect(geocoding.ensureRegionCoordinates('Spain', 'Rioja')).resolves.toBeUndefined();
    expect(coordsFile()).toEqual({});
  });
});

describe('readCoordinates', () => {
  it('returns {} when the cache file does not exist yet', () => {
    expect(geocoding.readCoordinates()).toEqual({});
  });

  it('returns the parsed cache file contents', () => {
    fs.writeFileSync(path.join(tmpDir, 'region-coordinates.json'), JSON.stringify({ 'Spain||Rioja': { lat: 1, lon: 2 } }));
    expect(geocoding.readCoordinates()).toEqual({ 'Spain||Rioja': { lat: 1, lon: 2 } });
  });
});
