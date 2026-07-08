import { describe, test, expect } from 'vitest';
import { weightedRating, buildWeightedRatings, buildProducerLeaderboard, buildProducerConsistency } from '../utils/analyticsHelpers';

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
