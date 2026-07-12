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

  it('resetFake clears all collections', async () => {
    const col = await db.getCollection('wine');
    await col.insertMany([{ id: 1 }]);
    db.resetFake();
    const col2 = await db.getCollection('wine');
    expect(await col2.find().toArray()).toEqual([]);
  });

  it('close() is a no-op when there is no real client', async () => {
    await expect(db.close()).resolves.toBeUndefined();
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
    mockClient = { connect: jest.fn().mockResolvedValue(), db: jest.fn(() => mockDb), close: jest.fn().mockResolvedValue() };
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
});
