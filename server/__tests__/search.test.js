jest.mock('../db');

const db = require('../db');
const { searchCategory, SEARCH_FIELDS } = require('../search');

function mockAggregate(docs) {
  const aggregate = jest.fn().mockReturnValue({ toArray: async () => docs });
  db.getCollection.mockResolvedValue({ aggregate });
  return aggregate;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('searchCategory', () => {
  it('sends a $search.text pipeline with the category\'s search fields, then a $project stripping _id', async () => {
    const aggregate = mockAggregate([]);
    await searchCategory('wine', 'margaux');
    expect(aggregate).toHaveBeenCalledWith([
      { $search: { text: { query: 'margaux', path: SEARCH_FIELDS.wine } } },
      { $project: { _id: 0 } },
    ]);
  });

  it('uses the correct search fields per category', async () => {
    const aggregate = mockAggregate([]);
    await searchCategory('beer', 'ipa');
    expect(aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      { $search: { text: { query: 'ipa', path: ['brewery', 'name'] } } },
    ]));
  });

  it('returns the matched docs', async () => {
    mockAggregate([{ id: 1, producer: 'Chateau Margaux' }]);
    const results = await searchCategory('wine', 'margaux');
    expect(results).toEqual([{ id: 1, producer: 'Chateau Margaux' }]);
  });

  it('filters out collectionOnly docs', async () => {
    mockAggregate([
      { id: 1, producer: 'Visible' },
      { id: 2, producer: 'Hidden', collectionOnly: true },
    ]);
    const results = await searchCategory('wine', 'x');
    expect(results).toEqual([{ id: 1, producer: 'Visible' }]);
  });
});
