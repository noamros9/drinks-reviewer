describe('db.js fake mode (no MONGODB_URI)', () => {
  let db;

  beforeEach(() => {
    delete process.env.MONGODB_URI;
    jest.resetModules();
    db = require('../db');
  });

  it('returns an empty array for a never-written category', async () => {
    const col = await db.getCollection('wine');
    expect(await col.find().toArray()).toEqual([]);
  });

  it('insertMany then find/toArray returns the inserted docs', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1 }, { id: 2 }]);
    expect(await col.find().toArray()).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('defensively copies documents on insert and on read', async () => {
    const col = await db.getCollection('wine');
    const doc = { id: 1 };
    await col.insertMany([doc]);
    doc.id = 999;
    const [read1] = await col.find().toArray();
    expect(read1.id).toBe(1);
    read1.id = 42;
    const [read2] = await col.find().toArray();
    expect(read2.id).toBe(1);
  });

  it('deleteMany clears the collection', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1 }]);
    await col.deleteMany({});
    expect(await col.find().toArray()).toEqual([]);
  });

  it('reuses the same in-memory collection across repeated getCollection calls', async () => {
    const col1 = await db.getCollection('wine');
    await col1.insertMany([{ id: 1 }]);
    const col2 = await db.getCollection('wine');
    expect(await col2.find().toArray()).toEqual([{ id: 1 }]);
  });

  it('keeps categories isolated from each other', async () => {
    const wineCol = await db.getCollection('wine');
    const beerCol = await db.getCollection('beer');
    await wineCol.insertMany([{ id: 'w1' }]);
    expect(await beerCol.find().toArray()).toEqual([]);
  });

  it('getRegionCoordinatesCollection lazily initializes the fake store on first call', async () => {
    const col = await db.getRegionCoordinatesCollection();
    await col.insertMany([{ _id: 'Spain||Rioja', lat: 1, lon: 2 }]);
    expect(await col.find().toArray()).toEqual([{ _id: 'Spain||Rioja', lat: 1, lon: 2 }]);
  });

  it('resetFake clears all collections', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1 }]);
    db.resetFake();
    const col2 = await db.getCollection('wine');
    expect(await col2.find().toArray()).toEqual([]);
  });

  it('withTransaction runs fn directly with no session when there is no real connection', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await db.withTransaction(fn);
    expect(fn).toHaveBeenCalledWith(undefined);
    expect(result).toBe('ok');
  });

  it('close() is a no-op when there is no real client', async () => {
    await expect(db.close()).resolves.toBeUndefined();
  });

  it('aggregate with $search.wildcard matches case-insensitive substrings across the given paths', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([
      { id: 1, producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' },
      { id: 2, producer: 'Opus One', seriesAndName: 'Napa Blend' },
    ]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: '*MARGAUX*', path: ['producer', 'seriesAndName'] } } },
    ]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' }]);
  });

  it('aggregate with $search.wildcard matches on any of the given paths', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' }]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: '*grand*', path: ['producer', 'seriesAndName'] } } },
    ]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' }]);
  });

  it('aggregate with $search.wildcard accepts a single string path', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, producer: 'Chateau Margaux' }]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: '*margaux*', path: 'producer' } } },
    ]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'Chateau Margaux' }]);
  });

  it('aggregate with $search.wildcard supports ? as a single-character glob', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, producer: 'margaux' }, { id: 2, producer: 'margauxx' }]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: 'margau?', path: 'producer' } } },
    ]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'margaux' }]);
  });

  it('aggregate with $search.wildcard treats an escaped * as a literal character', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, producer: 'a*b' }, { id: 2, producer: 'axb' }]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: 'a\\*b', path: 'producer' } } },
    ]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'a*b' }]);
  });

  it('aggregate ignores unknown stages', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, producer: 'Chateau Margaux' }]);
    const results = await col.aggregate([{ $project: { _id: 0 } }]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'Chateau Margaux' }]);
  });

  it('aggregate with a $match stage filters by equality', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, _category: 'whiskey' }, { id: 2, _category: 'others' }]);
    const results = await col.aggregate([{ $match: { _category: 'others' } }]).toArray();
    expect(results).toEqual([{ id: 2, _category: 'others' }]);
  });

  it('$search accepts a single (non-array) path field', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, producer: 'Chateau Margaux' }]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: '*margaux*', path: 'producer' } } },
    ]).toArray();
    expect(results).toEqual([{ id: 1, producer: 'Chateau Margaux' }]);
  });

  it('$search treats a doc missing the searched field as non-matching, not a crash', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1 }]);
    const results = await col.aggregate([
      { $search: { wildcard: { query: '*margaux*', path: 'producer' } } },
    ]).toArray();
    expect(results).toEqual([]);
  });

  it('find(filter) only returns matching docs', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, country: 'France' }, { id: 2, country: 'Italy' }]);
    expect(await col.find({ country: 'Italy' }).toArray()).toEqual([{ id: 2, country: 'Italy' }]);
  });

  it('deleteMany(filter) only removes matching docs', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1, country: 'France' }, { id: 2, country: 'Italy' }]);
    await col.deleteMany({ country: 'Italy' });
    expect(await col.find().toArray()).toEqual([{ id: 1, country: 'France' }]);
  });

  it('deleteMany() with no filter clears the whole collection', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1 }, { id: 2 }]);
    await col.deleteMany();
    expect(await col.find().toArray()).toEqual([]);
  });

  describe('whiskey/others share the physical whiskeys collection via scopeByCategory', () => {
    it('stay logically scoped from each other on insert/find', async () => {
      const whiskeyCol = await db.getCollection('whiskey');
      const othersCol = await db.getCollection('others');
      await whiskeyCol.insertMany([{ id: 'w1', name: 'Glenlivet' }]);
      await othersCol.insertMany([{ id: 'o1', name: 'Rum' }]);
      expect(await whiskeyCol.find().toArray()).toEqual([{ id: 'w1', name: 'Glenlivet', _category: 'whiskey' }]);
      expect(await othersCol.find().toArray()).toEqual([{ id: 'o1', name: 'Rum', _category: 'others' }]);
    });

    it('deleteMany on one tag does not affect the other', async () => {
      const whiskeyCol = await db.getCollection('whiskey');
      const othersCol = await db.getCollection('others');
      await whiskeyCol.insertMany([{ id: 'w1' }]);
      await othersCol.insertMany([{ id: 'o1' }]);
      await othersCol.deleteMany({});
      expect(await whiskeyCol.find().toArray()).toEqual([{ id: 'w1', _category: 'whiskey' }]);
      expect(await othersCol.find().toArray()).toEqual([]);
    });

    it('$search aggregate scoped to whiskey does not match others docs', async () => {
      const whiskeyCol = await db.getCollection('whiskey');
      const othersCol = await db.getCollection('others');
      await whiskeyCol.insertMany([{ id: 'w1', name: 'Glenlivet Cask' }]);
      await othersCol.insertMany([{ id: 'o1', name: 'Cask Rum' }]);
      const results = await whiskeyCol.aggregate([
        { $search: { wildcard: { query: '*cask*', path: ['name'] } } },
      ]).toArray();
      expect(results).toEqual([{ id: 'w1', name: 'Glenlivet Cask', _category: 'whiskey' }]);
    });
  });
});

describe('db.js real mode (MONGODB_URI set)', () => {
  let db;
  let mockCollection;
  let mockDb;
  let mockClient;
  let MockMongoClient;

  beforeEach(() => {
    mockCollection = { fake: 'collection' };
    mockDb = { collection: jest.fn(() => mockCollection) };
    mockClient = {
      connect: jest.fn().mockResolvedValue(),
      db: jest.fn(() => mockDb),
      close: jest.fn().mockResolvedValue(),
      startSession: jest.fn(),
    };
    MockMongoClient = jest.fn(() => mockClient);
    jest.resetModules();
    jest.doMock('mongodb', () => ({ MongoClient: MockMongoClient }));
    process.env.MONGODB_URI = 'mongodb://test';
    process.env.MONGODB_DB = 'testdb';
    db = require('../db');
  });

  afterEach(() => {
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB;
    jest.dontMock('mongodb');
  });

  it('connects once and reuses the client on subsequent getCollection calls', async () => {
    await db.getCollection('wine');
    await db.getCollection('beer');
    expect(MockMongoClient).toHaveBeenCalledTimes(1);
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
  });

  it('getCollection returns the named collection from the connected db', async () => {
    const col = await db.getCollection('wine');
    expect(mockDb.collection).toHaveBeenCalledWith('wines');
    expect(col).toBe(mockCollection);
  });

  it('close() closes the real client', async () => {
    await db.getCollection('wine');
    await db.close();
    expect(mockClient.close).toHaveBeenCalledTimes(1);
  });

  it('getRegionCoordinatesCollection returns the regionCoordinates collection from the connected db', async () => {
    const col = await db.getRegionCoordinatesCollection();
    expect(mockDb.collection).toHaveBeenCalledWith('regionCoordinates');
    expect(col).toBe(mockCollection);
  });

  describe('withTransaction', () => {
    it('runs fn inside a real session and ends the session afterwards', async () => {
      const session = { withTransaction: jest.fn(cb => cb()) };
      mockClient.startSession.mockReturnValue({ ...session, endSession: jest.fn().mockResolvedValue() });
      const fn = jest.fn().mockResolvedValue('result');

      const result = await db.withTransaction(fn);

      expect(mockClient.startSession).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(expect.anything());
      expect(result).toBe('result');
    });

    it('ends the session even if fn throws', async () => {
      const endSession = jest.fn().mockResolvedValue();
      mockClient.startSession.mockReturnValue({ withTransaction: cb => cb(), endSession });

      await expect(db.withTransaction(() => { throw new Error('boom'); })).rejects.toThrow('boom');
      expect(endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('whiskey/others scoping (scopeByCategory)', () => {
    beforeEach(() => {
      mockCollection.find = jest.fn(() => ({ toArray: jest.fn() }));
      mockCollection.deleteMany = jest.fn();
      mockCollection.insertMany = jest.fn();
      mockCollection.aggregate = jest.fn(() => ({ toArray: jest.fn() }));
    });

    it('both whiskey and others resolve to the whiskeys collection, wrapped (not the raw mock)', async () => {
      const whiskeyCol = await db.getCollection('whiskey');
      const othersCol = await db.getCollection('others');
      expect(mockDb.collection).toHaveBeenCalledWith('whiskeys');
      expect(whiskeyCol).not.toBe(mockCollection);
      expect(othersCol).not.toBe(mockCollection);
    });

    it('find/deleteMany/insertMany inject the _category tag', async () => {
      const whiskeyCol = await db.getCollection('whiskey');
      const othersCol = await db.getCollection('others');

      whiskeyCol.find({ foo: 1 }, { projection: { _id: 0 } });
      expect(mockCollection.find).toHaveBeenCalledWith({ foo: 1, _category: 'whiskey' }, { projection: { _id: 0 } });

      await othersCol.deleteMany({}, { session: 'sess' });
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ _category: 'others' }, { session: 'sess' });

      await whiskeyCol.insertMany([{ id: 1 }], { session: 'sess' });
      expect(mockCollection.insertMany).toHaveBeenCalledWith([{ id: 1, _category: 'whiskey' }], { session: 'sess' });
    });

    it('find/deleteMany fall back to an empty filter when called with no arguments', async () => {
      const whiskeyCol = await db.getCollection('whiskey');

      whiskeyCol.find();
      expect(mockCollection.find).toHaveBeenCalledWith({ _category: 'whiskey' }, undefined);

      await whiskeyCol.deleteMany();
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ _category: 'whiskey' }, undefined);
    });

    it('aggregate inserts a $match after $search when present', async () => {
      const othersCol = await db.getCollection('others');
      othersCol.aggregate([{ $search: { text: {} } }, { $project: {} }]);
      expect(mockCollection.aggregate).toHaveBeenCalledWith([
        { $search: { text: {} } },
        { $match: { _category: 'others' } },
        { $project: {} },
      ]);
    });

    it('aggregate prepends a $match when there is no $search stage', async () => {
      const whiskeyCol = await db.getCollection('whiskey');
      whiskeyCol.aggregate([{ $project: {} }]);
      expect(mockCollection.aggregate).toHaveBeenCalledWith([
        { $match: { _category: 'whiskey' } },
        { $project: {} },
      ]);
    });
  });
});
