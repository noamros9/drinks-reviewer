import { describe, test, expect } from 'vitest';
import { buildDiscoveryPace, buildSeasonalPattern, buildCategoryTrend } from '../utils/analyticsHelpers';

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
