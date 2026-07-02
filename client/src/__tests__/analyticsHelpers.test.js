import { describe, test, expect } from 'vitest';
import { bucketIndexForRating, buildRatingHistogram, RATING_BUCKETS } from '../utils/analyticsHelpers';

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
