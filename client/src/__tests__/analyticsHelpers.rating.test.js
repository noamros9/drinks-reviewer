import { describe, test, expect } from 'vitest';
import {
  bucketIndexForRating, buildRatingHistogram, RATING_BUCKETS,
  parseDrinkDate, computePercentiles, buildRatingTrend, buildCategoryComparison,
  drinkLabel, buildConsistencyLeaderboard,
} from '../utils/analyticsHelpers';

describe('bucketIndexForRating', () => {
  test.each([
    [1, 0],
    [1.99, 0],
    [2, 1],
    [6.99, 5],
    [7, 6],
    [9.99, 8],
    [10, 8],
  ])('rating %s -> bucket index %s', (rating, expected) => {
    expect(bucketIndexForRating(rating)).toBe(expected);
  });

  test.each([undefined, null, NaN, 'not a number'])('non-numeric input %s -> null', (val) => {
    expect(bucketIndexForRating(val)).toBeNull();
  });
});

describe('buildRatingHistogram', () => {
  test('empty array returns 9 zero-count buckets', () => {
    const result = buildRatingHistogram([]);
    expect(result).toHaveLength(RATING_BUCKETS.length);
    expect(result.every(b => b.count === 0)).toBe(true);
    expect(result[0]).toEqual({ min: 1, max: 2, label: '1-2', count: 0 });
    expect(result[8]).toEqual({ min: 9, max: 10, label: '9-10', count: 0 });
  });

  test('excludes drinks with missing avgRating', () => {
    const drinks = [{ avgRating: 7 }, { avgRating: undefined }, { }];
    const result = buildRatingHistogram(drinks);
    expect(result.reduce((s, b) => s + b.count, 0)).toBe(1);
    expect(result[6].count).toBe(1);
  });

  test('correctly buckets a small (5-entry) fixture with no size-based special path', () => {
    const drinks = [
      { avgRating: 4 },
      { avgRating: 8 },
      { avgRating: 7.5 },
      { avgRating: 5.5 },
      { avgRating: 4 },
    ];
    const result = buildRatingHistogram(drinks);
    const byLabel = Object.fromEntries(result.map(b => [b.label, b.count]));
    expect(byLabel['4-5']).toBe(2);
    expect(byLabel['5-6']).toBe(1);
    expect(byLabel['7-8']).toBe(1);
    expect(byLabel['8-9']).toBe(1);
    expect(result.reduce((s, b) => s + b.count, 0)).toBe(5);
  });
});

describe('parseDrinkDate', () => {
  test('parses a valid dd/MM/yyyy string', () => {
    const d = parseDrinkDate('16/04/2025');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(16);
  });

  test.each([undefined, null, '', 'not a date'])('invalid input %s -> null', (val) => {
    expect(parseDrinkDate(val)).toBeNull();
  });
});

describe('computePercentiles', () => {
  test('empty array -> all pct 0', () => {
    const result = computePercentiles([]);
    expect(result.every(r => r.pct === 0)).toBe(true);
  });

  test('boundary: avgRating exactly at threshold counts as above (>= semantics)', () => {
    const drinks = [{ avgRating: 7 }, { avgRating: 9.5 }];
    const result = computePercentiles(drinks, [7, 9.5]);
    expect(result[0]).toEqual({ threshold: 7, count: 2, pct: 100 });
    expect(result[1]).toEqual({ threshold: 9.5, count: 1, pct: 50 });
  });

  test('excludes drinks with missing avgRating from the denominator', () => {
    const drinks = [{ avgRating: 8 }, { avgRating: undefined }, {}];
    const result = computePercentiles(drinks, [8]);
    expect(result[0]).toEqual({ threshold: 8, count: 1, pct: 100 });
  });
});

describe('buildRatingTrend', () => {
  test('buckets tastings by month, sorted chronologically', () => {
    const drinks = [
      { tastings: [{ date: '10/03/2025', rating: 8 }, { date: '20/03/2025', rating: 6 }] },
      { tastings: [{ date: '05/01/2025', rating: 9 }] },
    ];
    const result = buildRatingTrend(drinks);
    expect(result).toEqual([
      { month: '2025-01', avgRating: 9, count: 1 },
      { month: '2025-03', avgRating: 7, count: 2 },
    ]);
  });

  test('skips a tasting with a bad rating or bad date without dropping the drink\'s other tastings', () => {
    const drinks = [{
      tastings: [
        { date: '10/03/2025', rating: 8 },
        { date: 'not a date', rating: 5 },
        { date: '11/03/2025', rating: NaN },
      ],
    }];
    const result = buildRatingTrend(drinks);
    expect(result).toEqual([{ month: '2025-03', avgRating: 8, count: 1 }]);
  });

  test('drink with no tastings key and empty input both produce []', () => {
    expect(buildRatingTrend([{ id: 'x' }])).toEqual([]);
    expect(buildRatingTrend([])).toEqual([]);
  });
});

describe('buildCategoryComparison', () => {
  test('includes all 4 categories even when one has zero rated drinks', () => {
    const drinks = [
      { _category: 'wine', avgRating: 8 },
      { _category: 'wine', avgRating: 6 },
      { _category: 'beer', avgRating: 9 },
    ];
    const result = buildCategoryComparison(drinks);
    const byCategory = Object.fromEntries(result.map(r => [r.category, r]));
    expect(byCategory.wine).toEqual({ category: 'wine', avgRating: 7, count: 2 });
    expect(byCategory.beer).toEqual({ category: 'beer', avgRating: 9, count: 1 });
    expect(byCategory.whiskey).toEqual({ category: 'whiskey', avgRating: 0, count: 0 });
    expect(byCategory.others).toEqual({ category: 'others', avgRating: 0, count: 0 });
  });
});

describe('drinkLabel', () => {
  test('producer + name', () => {
    expect(drinkLabel({ producer: 'Chateau X', seriesAndName: 'Grand Cru' })).toBe('Chateau X Grand Cru');
  });

  test('brewery + name', () => {
    expect(drinkLabel({ brewery: 'Brew Co', name: 'Pale Ale' })).toBe('Brew Co Pale Ale');
  });

  test('all fields missing -> Unknown', () => {
    expect(drinkLabel({})).toBe('Unknown');
  });
});

describe('buildConsistencyLeaderboard', () => {
  test('excludes drinks with fewer than 2 valid ratings', () => {
    const drinks = [
      { id: '1', tastings: [{ rating: 8 }] },
      { id: '2', tastings: [{ rating: 8 }, { rating: NaN }] },
      { id: '3', tastings: [] },
      { id: '4' },
    ];
    const result = buildConsistencyLeaderboard(drinks);
    expect(result.mostConsistent).toEqual([]);
    expect(result.leastConsistent).toEqual([]);
  });

  test('ranks by population standard deviation, most and least consistent', () => {
    const drinks = [
      { id: 'steady', producer: 'A', seriesAndName: 'Steady', tastings: [{ rating: 7 }, { rating: 7 }] },
      { id: 'wild', producer: 'B', seriesAndName: 'Wild', tastings: [{ rating: 4 }, { rating: 10 }] },
    ];
    const result = buildConsistencyLeaderboard(drinks, 5);
    expect(result.mostConsistent[0].id).toBe('steady');
    expect(result.mostConsistent[0].stdDev).toBe(0);
    expect(result.leastConsistent[0].id).toBe('wild');
    expect(result.leastConsistent[0].stdDev).toBe(3);
  });

  test('respects n and empty input', () => {
    const drinks = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`, tastings: [{ rating: i }, { rating: i + 1 }],
    }));
    const result = buildConsistencyLeaderboard(drinks, 3);
    expect(result.mostConsistent).toHaveLength(3);
    expect(result.leastConsistent).toHaveLength(3);
    expect(buildConsistencyLeaderboard([])).toEqual({ mostConsistent: [], leastConsistent: [] });
  });

  test('each entry carries a reference to its original drink object', () => {
    const drink = { id: 'steady', producer: 'A', seriesAndName: 'Steady', tastings: [{ rating: 7 }, { rating: 7 }] };
    const result = buildConsistencyLeaderboard([drink]);
    expect(result.mostConsistent[0].drink).toBe(drink);
  });
});
