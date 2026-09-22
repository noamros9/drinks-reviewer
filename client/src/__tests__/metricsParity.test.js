// The server keeps its own CommonJS copy of the price/rating math (server/metrics.js) because the
// client is ESM. This test runs both copies over the same drinks so drift fails CI.
import { avgLotPrice, median, weightedRating, buildWeightedRatings } from '../utils/analyticsHelpers';
import server from '../../../server/metrics.js';

const PRICE_FIXTURES = {
  'lots only': { collection: [{ price: 40 }, { price: 50 }] },
  'estimated only': { collection: [], estimatedPrice: 55 },
  'lots win over estimate': { collection: [{ price: 40 }], estimatedPrice: 99 },
  'no price at all': { collection: [{ quantity: 1 }] },
  'NaN lot price ignored': { collection: [{ price: NaN }, { price: 30 }] },
  'uneven average': { collection: [{ price: 10 }, { price: 10 }, { price: 11 }] },
};

describe('client/server metrics parity', () => {
  it.each(Object.entries(PRICE_FIXTURES))('avgLotPrice agrees: %s', (_, drink) => {
    const client = avgLotPrice(drink);
    const srv = server.avgLotPrice(drink);
    if (client === null) expect(srv).toBeNull();
    else expect(srv).toBeCloseTo(client, 2);
  });

  it('median agrees', () => {
    for (const nums of [[3], [1, 5], [4, 1, 9], [2, 2, 8, 10]]) {
      expect(server.median(nums)).toBe(median(nums));
    }
  });

  it('weightedRating agrees', () => {
    for (const [R, v, C, m] of [[9, 1, 7, 2], [6, 10, 8, 3], [8.5, 3, 8.5, 3]]) {
      expect(server.weightedRating(R, v, C, m)).toBeCloseTo(weightedRating(R, v, C, m), 2);
    }
  });

  it('buildWeightedRatings agrees (tastingCount >= 1, as tastingsHelper guarantees)', () => {
    const drinks = [
      { id: 'a', avgRating: 9, tastingCount: 1 },
      { id: 'b', avgRating: 7.5, tastingCount: 4 },
      { id: 'c', avgRating: 6, tastingCount: 2 },
    ];
    const client = buildWeightedRatings(drinks);
    const srv = server.buildWeightedRatings(drinks);
    for (const { id } of drinks) expect(srv.get(id)).toBeCloseTo(client.get(id), 2);
  });
});
