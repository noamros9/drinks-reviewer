import { describe, test, expect } from 'vitest';
import { buildCountryRanking, buildOldNewWorldBreakdown, buildRegionLeaderboard } from '../utils/analyticsHelpers';

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
