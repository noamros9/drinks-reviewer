import { describe, test, expect } from 'vitest';
import { buildAbvHistogram, buildAbvVsRatingScatter, buildAbvCategoryComparison } from '../utils/analyticsHelpers';

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
