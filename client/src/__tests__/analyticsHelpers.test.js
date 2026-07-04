import { describe, test, expect } from 'vitest';
import {
  bucketIndexForRating, buildRatingHistogram, RATING_BUCKETS,
  parseDrinkDate, computePercentiles, buildRatingTrend, buildCategoryComparison,
  drinkLabel, buildConsistencyLeaderboard,
  buildAbvHistogram, buildAbvVsRatingScatter, buildAbvCategoryComparison,
  buildCountryRanking, buildOldNewWorldBreakdown, buildRegionLeaderboard,
  buildDiscoveryPace, buildSeasonalPattern, buildCategoryTrend,
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

describe('buildAbvHistogram', () => {
  test('empty array -> []', () => {
    expect(buildAbvHistogram([])).toEqual([]);
  });

  test('excludes drinks with missing/non-numeric abv', () => {
    const drinks = [{ abv: 12 }, { abv: undefined }, {}, { abv: 'nope' }];
    const result = buildAbvHistogram(drinks);
    expect(result.reduce((s, b) => s + b.count, 0)).toBe(1);
  });

  test('single value (or all-identical values) collapses into one degenerate bucket, no divide-by-zero', () => {
    const result = buildAbvHistogram([{ abv: 13 }, { abv: 13 }, { abv: 13 }]);
    expect(result).toEqual([{ min: 13, max: 13, label: '13', count: 3 }]);
  });

  test('spreads values across bucketCount buckets spanning exactly [min, max]', () => {
    const drinks = [{ abv: 4 }, { abv: 10 }, { abv: 30 }, { abv: 58 }];
    const result = buildAbvHistogram(drinks, 4);
    expect(result).toHaveLength(4);
    expect(result[0].min).toBe(4);
    expect(result[3].max).toBe(58);
    expect(result.reduce((s, b) => s + b.count, 0)).toBe(4);
  });

  test('string-typed abv is coerced and counted, not dropped', () => {
    const drinks = [{ abv: 12 }, { abv: '12' }];
    const result = buildAbvHistogram(drinks);
    expect(result.reduce((s, b) => s + b.count, 0)).toBe(2);
  });

  test('custom bucketCount is respected', () => {
    const drinks = [{ abv: 5 }, { abv: 20 }];
    expect(buildAbvHistogram(drinks, 2)).toHaveLength(2);
  });
});

describe('buildAbvVsRatingScatter', () => {
  test('one point per drink with both a valid numeric abv and rating', () => {
    const drinks = [
      { id: '1', abv: 13, avgRating: 8, producer: 'A', seriesAndName: 'X' },
      { id: '2', abv: undefined, avgRating: 7 },
      { id: '3', abv: 12, avgRating: undefined },
    ];
    const result = buildAbvVsRatingScatter(drinks);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '1', abv: 13, rating: 8, label: 'A X' });
  });

  test('string-typed abv is coerced', () => {
    const drinks = [{ id: '1', abv: '13', avgRating: 8 }];
    expect(buildAbvVsRatingScatter(drinks)[0].abv).toBe(13);
  });

  test('each point carries a reference to its original drink object', () => {
    const drink = { id: '1', abv: 13, avgRating: 8 };
    expect(buildAbvVsRatingScatter([drink])[0].drink).toBe(drink);
  });
});

describe('buildAbvCategoryComparison', () => {
  test('includes all 4 categories even when one has zero valid-abv drinks', () => {
    const drinks = [
      { _category: 'wine', abv: 12 },
      { _category: 'wine', abv: 14 },
      { _category: 'beer', abv: 5 },
    ];
    const result = buildAbvCategoryComparison(drinks);
    const byCategory = Object.fromEntries(result.map(r => [r.category, r]));
    expect(byCategory.wine).toEqual({ category: 'wine', avgAbv: 13, count: 2 });
    expect(byCategory.beer).toEqual({ category: 'beer', avgAbv: 5, count: 1 });
    expect(byCategory.whiskey).toEqual({ category: 'whiskey', avgAbv: 0, count: 0 });
    expect(byCategory.others).toEqual({ category: 'others', avgAbv: 0, count: 0 });
  });

  test('string-typed abv is included in the average', () => {
    const drinks = [{ _category: 'wine', abv: '12' }, { _category: 'wine', abv: 14 }];
    const result = buildAbvCategoryComparison(drinks);
    expect(result.find(r => r.category === 'wine')).toEqual({ category: 'wine', avgAbv: 13, count: 2 });
  });
});

describe('buildCountryRanking', () => {
  test('one row per distinct country present, excludes drinks with no country', () => {
    const drinks = [
      { country: 'Italy', avgRating: 8 },
      { country: 'Italy', avgRating: 6 },
      { country: 'France', avgRating: 9 },
      { country: undefined, avgRating: 7 },
      {},
    ];
    const result = buildCountryRanking(drinks);
    const byCountry = Object.fromEntries(result.map(r => [r.country, r]));
    expect(Object.keys(byCountry).sort()).toEqual(['France', 'Italy']);
    expect(byCountry.Italy).toEqual({ country: 'Italy', avgRating: 7, count: 2 });
    expect(byCountry.France).toEqual({ country: 'France', avgRating: 9, count: 1 });
  });

  test('a country with no valid-rating drinks still appears with avgRating 0, count 0', () => {
    const result = buildCountryRanking([{ country: 'Spain', avgRating: undefined }]);
    expect(result).toEqual([{ country: 'Spain', avgRating: 0, count: 0 }]);
  });

  test('empty array -> []', () => {
    expect(buildCountryRanking([])).toEqual([]);
  });
});

describe('buildOldNewWorldBreakdown', () => {
  test('always exactly 3 buckets (Old World / New World / Other), even on empty input', () => {
    const result = buildOldNewWorldBreakdown([]);
    expect(result.map(r => r.label)).toEqual(['Old World', 'New World', 'Other']);
    expect(result.every(r => r.avgRating === 0 && r.count === 0)).toBe(true);
  });

  test('classifies known Old World / New World countries and buckets unknowns as Other', () => {
    const drinks = [
      { country: 'France', avgRating: 8 },
      { country: 'Italy', avgRating: 6 },
      { country: 'Argentina', avgRating: 9 },
      { country: 'Atlantis', avgRating: 5 },
    ];
    const result = buildOldNewWorldBreakdown(drinks);
    const byLabel = Object.fromEntries(result.map(r => [r.label, r]));
    expect(byLabel['Old World']).toEqual({ label: 'Old World', avgRating: 7, count: 2 });
    expect(byLabel['New World']).toEqual({ label: 'New World', avgRating: 9, count: 1 });
    expect(byLabel.Other).toEqual({ label: 'Other', avgRating: 5, count: 1 });
  });

  test('drinks with no country are skipped entirely', () => {
    const result = buildOldNewWorldBreakdown([{ avgRating: 8 }, {}]);
    expect(result.every(r => r.count === 0)).toBe(true);
  });
});

describe('buildRegionLeaderboard', () => {
  test('groups by category+country+region, skips drinks with no region or empty-string region', () => {
    const drinks = [
      { _category: 'wine', country: 'Israel', region: 'Galilee', avgRating: 8 },
      { _category: 'wine', country: 'Israel', region: 'Galilee', avgRating: 6 },
      { _category: 'wine', country: 'Israel', region: '', avgRating: 7 },
      { _category: 'wine', country: 'Israel', avgRating: 5 },
      { _category: 'wine', country: 'Italy', region: 'Chianti', avgRating: 9 },
    ];
    const result = buildRegionLeaderboard(drinks);
    expect(result).toHaveLength(2);
    const byRegion = Object.fromEntries(result.map(r => [r.region, r]));
    expect(byRegion.Galilee).toEqual({ category: 'wine', country: 'Israel', region: 'Galilee', avgRating: 7, count: 2 });
    expect(byRegion.Chianti).toEqual({ category: 'wine', country: 'Italy', region: 'Chianti', avgRating: 9, count: 1 });
  });

  test('the same country+region name in two different categories is kept as two separate rows', () => {
    const drinks = [
      { _category: 'wine', country: 'Scotland', region: 'Highlands', avgRating: 7 },
      { _category: 'whiskey', country: 'Scotland', region: 'Highlands', avgRating: 9 },
    ];
    const result = buildRegionLeaderboard(drinks);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.category).sort()).toEqual(['whiskey', 'wine']);
  });

  test('a region whose drinks have no valid rating is excluded entirely (not shown as 0)', () => {
    const result = buildRegionLeaderboard([{ _category: 'wine', country: 'Italy', region: 'Chianti', avgRating: undefined }]);
    expect(result).toEqual([]);
  });

  test('sorted descending by avgRating and respects n', () => {
    const drinks = [
      { _category: 'wine', country: 'A', region: 'Low', avgRating: 4 },
      { _category: 'wine', country: 'B', region: 'High', avgRating: 9 },
      { _category: 'wine', country: 'C', region: 'Mid', avgRating: 6 },
    ];
    const result = buildRegionLeaderboard(drinks, 2);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.region)).toEqual(['High', 'Mid']);
  });

  test('empty array -> []', () => {
    expect(buildRegionLeaderboard([])).toEqual([]);
  });
});

describe('buildDiscoveryPace', () => {
  test('buckets each drink by its earliest tasting date, sorted chronologically', () => {
    const drinks = [
      { tastings: [{ date: '20/03/2025' }, { date: '10/01/2025' }] },
      { tastings: [{ date: '05/01/2025' }] },
      { tastings: [{ date: '15/02/2025' }] },
    ];
    expect(buildDiscoveryPace(drinks)).toEqual([
      { month: '2025-01', count: 2 },
      { month: '2025-02', count: 1 },
    ]);
  });

  test('drink with no tastings key, or an empty tastings array, is excluded', () => {
    expect(buildDiscoveryPace([{ id: 'x' }, { tastings: [] }])).toEqual([]);
  });

  test('drink whose only tasting has an unparseable date is excluded', () => {
    expect(buildDiscoveryPace([{ tastings: [{ date: 'not a date' }] }])).toEqual([]);
  });

  test('empty input -> []', () => {
    expect(buildDiscoveryPace([])).toEqual([]);
  });
});

describe('buildSeasonalPattern', () => {
  test('always returns 12 calendar-month buckets, Jan..Dec, even at 0', () => {
    const result = buildSeasonalPattern([]);
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ month: 'Jan', count: 0 });
    expect(result[11]).toEqual({ month: 'Dec', count: 0 });
  });

  test('aggregates tastings across different years into the same calendar month', () => {
    const drinks = [{ tastings: [{ date: '10/03/2024' }, { date: '15/03/2025' }, { date: '01/06/2025' }] }];
    const result = buildSeasonalPattern(drinks);
    expect(result.find(r => r.month === 'Mar').count).toBe(2);
    expect(result.find(r => r.month === 'Jun').count).toBe(1);
  });

  test('counts every tasting, not just a drink\'s first', () => {
    const drinks = [{ tastings: [{ date: '01/01/2025' }, { date: '02/01/2025' }] }];
    expect(buildSeasonalPattern(drinks).find(r => r.month === 'Jan').count).toBe(2);
  });

  test('skips tastings with an unparseable date', () => {
    const drinks = [{ tastings: [{ date: '01/01/2025' }, { date: 'bad' }] }];
    expect(buildSeasonalPattern(drinks).find(r => r.month === 'Jan').count).toBe(1);
  });
});

describe('buildCategoryTrend', () => {
  test('wide format: one row per month with all 4 category keys, chronological', () => {
    const drinks = [
      { _category: 'wine', tastings: [{ date: '10/01/2025' }] },
      { _category: 'beer', tastings: [{ date: '15/01/2025' }, { date: '20/02/2025' }] },
    ];
    expect(buildCategoryTrend(drinks)).toEqual([
      { month: '2025-01', wine: 1, beer: 1, whiskey: 0, others: 0 },
      { month: '2025-02', wine: 0, beer: 1, whiskey: 0, others: 0 },
    ]);
  });

  test('a month with tastings in only one category still includes the other 3 at 0', () => {
    const drinks = [{ _category: 'whiskey', tastings: [{ date: '01/05/2025' }] }];
    expect(buildCategoryTrend(drinks)).toEqual([{ month: '2025-05', wine: 0, beer: 0, whiskey: 1, others: 0 }]);
  });

  test('empty input -> []', () => {
    expect(buildCategoryTrend([])).toEqual([]);
  });
});
