import { describe, test, expect } from 'vitest';
import {
  bucketIndexForRating, buildRatingHistogram, RATING_BUCKETS,
  parseDrinkDate, computePercentiles, buildRatingTrend, buildCategoryComparison,
  drinkLabel, buildConsistencyLeaderboard,
  buildAbvHistogram, buildAbvVsRatingScatter, buildAbvCategoryComparison,
  buildCountryRanking, buildOldNewWorldBreakdown, buildRegionLeaderboard,
  buildDiscoveryPace, buildSeasonalPattern, buildCategoryTrend,
  buildStyleLeaderboard, buildUndiscovered,
  weightedRating, buildWeightedRatings, buildBestOf,
  buildProducerLeaderboard, buildProducerConsistency,
  buildVintageLeaderboard, buildAgeVsRatingScatter,
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
    expect(byCountry.Italy).toMatchObject({ country: 'Italy', avgRating: 7, count: 2 });
    expect(byCountry.France).toMatchObject({ country: 'France', avgRating: 9, count: 1 });
  });

  test('a country with no valid-rating drinks still appears with avgRating 0, count 0', () => {
    const result = buildCountryRanking([{ country: 'Spain', avgRating: undefined }]);
    expect(result).toEqual([{ country: 'Spain', avgRating: 0, count: 0, weightedRating: 0 }]);
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
    expect(byRegion.Galilee).toMatchObject({ category: 'wine', country: 'Israel', region: 'Galilee', avgRating: 7, count: 2 });
    expect(byRegion.Chianti).toMatchObject({ category: 'wine', country: 'Italy', region: 'Chianti', avgRating: 9, count: 1 });
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

describe('buildStyleLeaderboard', () => {
  test('wine grape mode splits blends so each grape counts separately', () => {
    const wine = [
      { variety: 'Merlot', avgRating: 8 },
      { variety: 'Cabernet Sauvignon, Merlot', avgRating: 6 },
    ];
    const rows = buildStyleLeaderboard(wine, 'wine', { splitBlends: true });
    // Merlot appears in both drinks; Cab only in the blend
    expect(rows).toMatchObject([
      { style: 'Merlot', avgRating: 7, count: 2 },
      { style: 'Cabernet Sauvignon', avgRating: 6, count: 1 },
    ]);
  });

  test('adds a weightedRating field shrinking each row toward the leaderboard mean', () => {
    const wine = [
      { variety: 'Merlot', avgRating: 7, },
      { variety: 'Merlot', avgRating: 7 },
      { variety: 'Cabernet Sauvignon', avgRating: 6 },
    ];
    const rows = buildStyleLeaderboard(wine, 'wine');
    // C = avgOf([7,6]) = 6.5, m = median([2,1]) = 1.5
    // Merlot: v=2 -> (2/3.5)*7 + (1.5/3.5)*6.5 = 6.79
    // Cabernet: v=1 -> (1/2.5)*6 + (1.5/2.5)*6.5 = 6.3
    expect(rows).toEqual([
      { style: 'Merlot', avgRating: 7, count: 2, weightedRating: 6.79 },
      { style: 'Cabernet Sauvignon', avgRating: 6, count: 1, weightedRating: 6.3 },
    ]);
  });

  test('wine blend mode keeps the whole variety string as one key', () => {
    const wine = [
      { variety: 'Merlot', avgRating: 8 },
      { variety: 'Cabernet Sauvignon, Merlot', avgRating: 6 },
    ];
    const rows = buildStyleLeaderboard(wine, 'wine', { splitBlends: false });
    expect(rows).toMatchObject([
      { style: 'Merlot', avgRating: 8, count: 1 },
      { style: 'Cabernet Sauvignon, Merlot', avgRating: 6, count: 1 },
    ]);
  });

  test('non-wine categories group by the style field', () => {
    const beer = [
      { style: 'IPA', avgRating: 9 },
      { style: 'IPA', avgRating: 8 },
      { style: 'Stout', avgRating: 7 },
    ];
    expect(buildStyleLeaderboard(beer, 'beer')).toMatchObject([
      { style: 'IPA', avgRating: 8.5, count: 2 },
      { style: 'Stout', avgRating: 7, count: 1 },
    ]);
  });

  test('drops empty styles and the "-" placeholder', () => {
    const others = [
      { style: 'Rum', avgRating: 6 },
      { style: '-', avgRating: 9 },
      { style: '', avgRating: 9 },
      { style: undefined, avgRating: 9 },
    ];
    expect(buildStyleLeaderboard(others, 'others')).toMatchObject([
      { style: 'Rum', avgRating: 6, count: 1 },
    ]);
  });

  test('skips drinks with no numeric avgRating', () => {
    const beer = [
      { style: 'IPA', avgRating: 8 },
      { style: 'IPA', avgRating: null },
      { style: 'IPA', avgRating: NaN },
    ];
    expect(buildStyleLeaderboard(beer, 'beer')).toMatchObject([
      { style: 'IPA', avgRating: 8, count: 1 },
    ]);
  });

  test('ties on count break by avg rating descending', () => {
    const beer = [
      { style: 'Lager', avgRating: 6 },
      { style: 'IPA', avgRating: 9 },
    ];
    expect(buildStyleLeaderboard(beer, 'beer').map(r => r.style)).toEqual(['IPA', 'Lager']);
  });
});

describe('buildProducerLeaderboard', () => {
  test('wine groups by producer field, includes weightedRating', () => {
    const wine = [
      { producer: 'Chateau', avgRating: 8 },
      { producer: 'Chateau', avgRating: 6 },
      { producer: 'Winery', avgRating: 9 },
    ];
    // C = avgOf([7,9]) = 8, m = median([2,1]) = 1.5
    expect(buildProducerLeaderboard(wine, 'wine')).toEqual([
      { style: 'Chateau', avgRating: 7, count: 2, weightedRating: 7.43 },
      { style: 'Winery', avgRating: 9, count: 1, weightedRating: 8.4 },
    ]);
  });

  test('beer groups by brewery field', () => {
    const beer = [
      { brewery: 'Alexander', avgRating: 9 },
      { brewery: 'Alexander', avgRating: 8 },
    ];
    expect(buildProducerLeaderboard(beer, 'beer')).toMatchObject([
      { style: 'Alexander', avgRating: 8.5, count: 2 },
    ]);
  });

  test('whiskey and others both group by the distillery field', () => {
    const whiskey = [{ distillery: 'Glendronach', avgRating: 9 }];
    const others = [{ distillery: 'Captain Morgan', avgRating: 4 }];
    expect(buildProducerLeaderboard(whiskey, 'whiskey')).toMatchObject([{ style: 'Glendronach', count: 1 }]);
    expect(buildProducerLeaderboard(others, 'others')).toMatchObject([{ style: 'Captain Morgan', count: 1 }]);
  });

  test('drops drinks with no producer name or no numeric avgRating', () => {
    const wine = [
      { producer: '', avgRating: 8 },
      { producer: undefined, avgRating: 8 },
      { producer: 'Chateau', avgRating: undefined },
      { producer: 'Chateau', avgRating: 8 },
    ];
    expect(buildProducerLeaderboard(wine, 'wine')).toEqual([
      { style: 'Chateau', avgRating: 8, count: 1, weightedRating: 8 },
    ]);
  });
});

describe('buildProducerConsistency', () => {
  test('groups by producer, requires >= 2 drinks, computes population std dev', () => {
    const wine = [
      { producer: 'Chateau', avgRating: 8 },
      { producer: 'Chateau', avgRating: 6 },
      { producer: 'Solo', avgRating: 9 }, // only 1 drink -> excluded
    ];
    const result = buildProducerConsistency(wine, 'wine');
    expect(result.mostConsistent).toEqual([{ producer: 'Chateau', stdDev: 1, count: 2 }]);
    expect(result.leastConsistent).toEqual([{ producer: 'Chateau', stdDev: 1, count: 2 }]);
  });

  test('drops the "-" placeholder and drinks with no numeric avgRating', () => {
    const others = [
      { distillery: '-', avgRating: 8 },
      { distillery: '-', avgRating: 6 },
      { distillery: 'Real', avgRating: undefined },
      { distillery: 'Real', avgRating: 7 },
    ];
    expect(buildProducerConsistency(others, 'others').mostConsistent).toEqual([]);
    expect(buildProducerConsistency(others, 'others').leastConsistent).toEqual([]);
  });

  test('sorts most consistent ascending and least consistent descending, and respects n', () => {
    const wine = [
      { producer: 'Tight', avgRating: 8 }, { producer: 'Tight', avgRating: 8.2 },
      { producer: 'Loose', avgRating: 4 }, { producer: 'Loose', avgRating: 9 },
    ];
    const result = buildProducerConsistency(wine, 'wine', 1);
    expect(result.mostConsistent.map(r => r.producer)).toEqual(['Tight']);
    expect(result.leastConsistent.map(r => r.producer)).toEqual(['Loose']);
  });

  test('empty input -> empty lists', () => {
    const result = buildProducerConsistency([], 'wine');
    expect(result).toEqual({ mostConsistent: [], leastConsistent: [] });
  });
});

describe('buildVintageLeaderboard', () => {
  test('a drink whose tastings span two vintages contributes to two separate rows (not d.avgRating/d.vintage)', () => {
    const wine = [
      {
        id: 'w1',
        avgRating: 7,   // drink-level avg — must be ignored
        vintage: '2024', // drink-level mirror — must be ignored
        tastings: [
          { vintage: '2023', rating: 8 },
          { vintage: '2024', rating: 6 },
        ],
      },
    ];
    // C = avgOf([8,6]) = 7, m = median([1,1]) = 1
    // 2023: (1/2)*8+(1/2)*7 = 7.5 ; 2024: (1/2)*6+(1/2)*7 = 6.5
    expect(buildVintageLeaderboard(wine)).toEqual([
      { style: '2023', avgRating: 8, count: 1, weightedRating: 7.5 },
      { style: '2024', avgRating: 6, count: 1, weightedRating: 6.5 },
    ]);
  });

  test('tastings from different drinks in the same vintage are pooled together', () => {
    const wine = [
      { id: 'w1', tastings: [{ vintage: '2020', rating: 9 }] },
      { id: 'w2', tastings: [{ vintage: '2020', rating: 7 }] },
    ];
    expect(buildVintageLeaderboard(wine)).toMatchObject([
      { style: '2020', avgRating: 8, count: 2 },
    ]);
  });

  test('skips tastings with a missing vintage or non-numeric rating', () => {
    const wine = [{
      id: 'w1',
      tastings: [
        { vintage: '', rating: 8 },
        { vintage: '2020', rating: null },
        { vintage: '2021', rating: NaN },
        { vintage: '2022', rating: 9 },
      ],
    }];
    expect(buildVintageLeaderboard(wine)).toEqual([
      { style: '2022', avgRating: 9, count: 1, weightedRating: 9 },
    ]);
  });

  test('empty input -> []', () => {
    expect(buildVintageLeaderboard([])).toEqual([]);
  });
});

describe('buildAgeVsRatingScatter', () => {
  test('computes age as tastingYear - vintageYear', () => {
    const wine = [{
      id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve',
      tastings: [{ id: 't1', vintage: '2020', rating: 8, date: '15/06/2025' }],
    }];
    expect(buildAgeVsRatingScatter(wine)).toEqual([
      { id: 't1', category: 'wine', label: 'Chateau Reserve', age: 5, rating: 8, drink: wine[0] },
    ]);
  });

  test('negative age (tasting predates its own vintage) is excluded', () => {
    const wine = [{ id: 'w1', _category: 'wine', tastings: [{ id: 't1', vintage: '2026', rating: 8, date: '01/01/2020' }] }];
    expect(buildAgeVsRatingScatter(wine)).toEqual([]);
  });

  test('age of 0 (tasted in the vintage year itself) is kept', () => {
    const wine = [{ id: 'w1', _category: 'wine', tastings: [{ id: 't1', vintage: '2020', rating: 8, date: '01/01/2020' }] }];
    expect(buildAgeVsRatingScatter(wine)).toMatchObject([{ age: 0 }]);
  });

  test('unparseable date or non-numeric vintage is skipped', () => {
    const wine = [{
      id: 'w1', _category: 'wine',
      tastings: [
        { id: 't1', vintage: '2020', rating: 8, date: '' },
        { id: 't2', vintage: 'abcd', rating: 8, date: '01/01/2020' },
      ],
    }];
    expect(buildAgeVsRatingScatter(wine)).toEqual([]);
  });

  test('a drink with N tastings yields N points, not 1', () => {
    const wine = [{
      id: 'w1', _category: 'wine',
      tastings: [
        { id: 't1', vintage: '2023', rating: 8, date: '01/01/2025' },
        { id: 't2', vintage: '2024', rating: 6, date: '01/01/2026' },
      ],
    }];
    expect(buildAgeVsRatingScatter(wine).map(p => p.id)).toEqual(['t1', 't2']);
  });

  test('empty input -> []', () => {
    expect(buildAgeVsRatingScatter([])).toEqual([]);
  });
});

describe('buildUndiscovered', () => {
  const rows = [
    { style: 'Riesling', avgRating: 9, count: 2 },   // in
    { style: 'Grenache', avgRating: 8, count: 3 },   // in (boundaries)
    { style: 'Merlot', avgRating: 7.9, count: 1 },   // out: avg too low
    { style: 'IPA', avgRating: 9, count: 4 },        // out: count too high
  ];

  test('keeps only avg >= 8 and count <= 3, sorted by avg desc', () => {
    expect(buildUndiscovered(rows)).toEqual([
      { style: 'Riesling', avgRating: 9, count: 2 },
      { style: 'Grenache', avgRating: 8, count: 3 },
    ]);
  });

  test('thresholds are overridable', () => {
    expect(buildUndiscovered(rows, { minAvg: 9, maxCount: 2 })).toEqual([
      { style: 'Riesling', avgRating: 9, count: 2 },
    ]);
  });
});

describe('weightedRating', () => {
  test('v=0 converges fully to the prior C', () => {
    expect(weightedRating(9, 0, 7, 5)).toBe(7);
  });

  test('large v converges close to the item\'s own R', () => {
    expect(weightedRating(9, 1000, 7, 5)).toBeCloseTo(9, 1);
  });

  test('v+m<=0 guards against division by zero and returns C', () => {
    expect(weightedRating(5, 0, 3, 0)).toBe(3);
  });

  test('a low-sample high rating can be overtaken by a well-tasted slightly-lower rating', () => {
    const oneOff = weightedRating(9.5, 1, 7, 5);
    const wellTasted = weightedRating(8.8, 9, 7, 5);
    expect(oneOff).toBe(7.42);
    expect(wellTasted).toBe(8.16);
    expect(wellTasted).toBeGreaterThan(oneOff);
  });
});

describe('buildWeightedRatings', () => {
  test('maps each drink id to its weighted rating using scope-derived C and m', () => {
    const drinks = [
      { id: 'a', avgRating: 7, tastingCount: 2 },
      { id: 'b', avgRating: 6, tastingCount: 1 },
    ];
    // C = avgOf([7,6]) = 6.5, m = median([2,1]) = 1.5
    const map = buildWeightedRatings(drinks);
    expect(map.get('a')).toBe(6.79);
    expect(map.get('b')).toBe(6.3);
  });

  test('drinks with no numeric avgRating are excluded from the map', () => {
    const map = buildWeightedRatings([{ id: 'a', avgRating: undefined }, { id: 'b', avgRating: NaN }]);
    expect(map.size).toBe(0);
  });

  test('empty input -> empty map', () => {
    expect(buildWeightedRatings([]).size).toBe(0);
  });
});

describe('buildBestOf', () => {
  const drinks = [
    { id: 'w1', producer: 'Chateau', seriesAndName: 'Reserve', _category: 'wine', avgRating: 9.5, tastingCount: 1 },
    { id: 'w2', producer: 'Winery', seriesAndName: 'Blend', _category: 'wine', avgRating: 8.8, tastingCount: 9 },
    { id: 'b1', brewery: 'Brewery', name: 'Ale', _category: 'beer', avgRating: 6.0, tastingCount: 1 },
  ];
  // C = avgOf([9.5,8.8,6.0]) = 8.1, m = median([1,9,1]) = 1
  // w1: 8.8, w2: 8.73, b1: 7.05

  test('ranks by weighted rating, not raw avgRating, so a well-tasted drink can rank above a one-off', () => {
    const result = buildBestOf(drinks, 10);
    expect(result.map(r => r.id)).toEqual(['w1', 'w2', 'b1']);
    expect(result.map(r => r.weightedRating)).toEqual([8.8, 8.73, 7.05]);
  });

  test('entries carry label, category, raw stats and the source drink', () => {
    const [top] = buildBestOf(drinks, 1);
    expect(top).toMatchObject({ id: 'w1', label: 'Chateau Reserve', category: 'wine', avgRating: 9.5, tastingCount: 1 });
    expect(top.drink).toBe(drinks[0]);
  });

  test('respects n', () => {
    expect(buildBestOf(drinks, 2).map(r => r.id)).toEqual(['w1', 'w2']);
  });

  test('drinks with no numeric avgRating are excluded', () => {
    const withUnrated = [...drinks, { id: 'x', producer: 'P', seriesAndName: 'Unrated', _category: 'wine', avgRating: undefined }];
    expect(buildBestOf(withUnrated, 10).some(r => r.id === 'x')).toBe(false);
  });

  test('empty input -> []', () => {
    expect(buildBestOf([], 10)).toEqual([]);
  });
});
