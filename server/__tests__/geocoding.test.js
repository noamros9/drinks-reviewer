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

// Nominatim happily answers "Judea, Israel" with a street in Santiago, Chile, which is how
// the Judean Hills marker ended up in South America. Every answer is checked against the
// country we asked about.
describe('country verification', () => {
  const respond = (address) => global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ lat: '-33.54', lon: '-70.76', address }]),
  });

  it('rejects a match from the wrong country', async () => {
    respond({ country_code: 'cl' });
    await geocoding.ensureRegionCoordinates('Israel', 'Judea');
    expect(await geocoding.readCoordinates()).toEqual({});
  });

  it('accepts a match from the right country', async () => {
    respond({ country_code: 'il' });
    await geocoding.ensureRegionCoordinates('Israel', 'Judean Hills');
    expect(await geocoding.readCoordinates()).toEqual({ 'Israel||Judean Hills': { lat: -33.54, lon: -70.76 } });
  });

  it('accepts gb for the UK constituent countries, which Nominatim does not treat as countries', async () => {
    respond({ country_code: 'gb' });
    await geocoding.ensureRegionCoordinates('Scotland', 'Highlands');
    expect(Object.keys(await geocoding.readCoordinates())).toEqual(['Scotland||Highlands']);
  });

  // An unlisted country means "can't verify", not "wrong" — a drink from a new country
  // should still get a marker rather than silently failing forever.
  it('accepts a result for a country it has no code for', async () => {
    respond({ country_code: 'zz' });
    await geocoding.ensureRegionCoordinates('Atlantis', 'Poseidonis');
    expect(Object.keys(await geocoding.readCoordinates())).toEqual(['Atlantis||Poseidonis']);
  });

  it('accepts a result that carries no address details', async () => {
    respond(undefined);
    await geocoding.ensureRegionCoordinates('Israel', 'Galilee');
    expect(Object.keys(await geocoding.readCoordinates())).toEqual(['Israel||Galilee']);
  });

  it('asks Nominatim for address details', async () => {
    respond({ country_code: 'il' });
    await geocoding.ensureRegionCoordinates('Israel', 'Galilee');
    expect(global.fetch.mock.calls[0][0]).toContain('addressdetails=1');
  });

  // Used by backfill-region-coordinates.js to audit coordinates already on file. Asking what
  // is AT the point is the only check that separates "wrong country" from "imprecise": a
  // fresh forward search for "Alsace, France" returns a street in Lille, so comparing
  // distance would condemn a correct coordinate.
  describe('coordinateIsInCountry', () => {
    const reverse = (address, ok = true) => global.fetch.mockResolvedValue({
      ok, json: () => Promise.resolve({ address }),
    });

    it('rejects the stored Judean Hills point, which reverse-geocodes to Chile', async () => {
      reverse({ country_code: 'cl' });
      await expect(geocoding.coordinateIsInCountry('Israel', { lat: -33.54, lon: -70.76 })).resolves.toBe(false);
    });

    it('keeps a point that really is in the country', async () => {
      reverse({ country_code: 'fr' });
      await expect(geocoding.coordinateIsInCountry('France', { lat: 48.3, lon: 7.5 })).resolves.toBe(true);
    });

    it('sends the point to the reverse endpoint', async () => {
      reverse({ country_code: 'fr' });
      await geocoding.coordinateIsInCountry('France', { lat: 48.3, lon: 7.5 });
      const [url] = global.fetch.mock.calls[0];
      expect(url).toContain('/reverse?lat=48.3&lon=7.5');
    });

    // Anything it can't confirm is kept — this drives deletions, so silence must not destroy.
    it('keeps the point when the country has no known code', async () => {
      await expect(geocoding.coordinateIsInCountry('Atlantis', { lat: 0, lon: 0 })).resolves.toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('keeps the point when Nominatim errors', async () => {
      reverse({ country_code: 'cl' }, false);
      await expect(geocoding.coordinateIsInCountry('Israel', { lat: 1, lon: 2 })).resolves.toBe(true);
    });

    it('keeps the point when the reverse lookup returns no country', async () => {
      reverse(undefined);
      await expect(geocoding.coordinateIsInCountry('Israel', { lat: 1, lon: 2 })).resolves.toBe(true);
    });
  });

  // "Judean Hills" finds nothing in Israel and "Judea" finds a street in Santiago; the
  // OpenStreetMap name for the place is "Judean Mountains".
  it('substitutes the OSM name for regions Nominatim does not know by their wine-trade name', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([{ lat: '31.8', lon: '35.0', address: { country_code: 'il' } }]) });
    await geocoding.ensureRegionCoordinates('Israel', 'Judean Hills');
    expect(global.fetch.mock.calls[0][0]).toContain(encodeURIComponent('Judean Mountains, Israel'));
  });

  it('maps country names to ISO codes, and leaves unknown ones undefined', () => {
    expect(geocoding.countryCode('Scotland')).toBe('gb');
    expect(geocoding.countryCode('Israel')).toBe('il');
    expect(geocoding.countryCode('Czech Republic')).toBe('cz');
    expect(geocoding.countryCode('Atlantis')).toBeUndefined();
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
