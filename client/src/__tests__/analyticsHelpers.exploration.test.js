import { describe, test, expect } from 'vitest';
import {
  buildBestOf, buildExplorerScore, buildNewCountriesThisYear, buildNewStylesThisYear, buildDrinksToRevisit,
} from '../utils/analyticsHelpers';

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

describe('buildExplorerScore', () => {
  test('unique countries / total entries, as a rounded percentage', () => {
    const drinks = [
      { id: 'a', country: 'Italy' }, { id: 'b', country: 'Italy' }, { id: 'c', country: 'France' },
    ];
    expect(buildExplorerScore(drinks)).toEqual({
      countries: ['France', 'Italy'], uniqueCount: 2, total: 3, pct: 66.7,
    });
  });

  test('drinks with no country are excluded from the country list but still count toward the total', () => {
    const drinks = [{ id: 'a', country: 'Italy' }, { id: 'b' }];
    expect(buildExplorerScore(drinks)).toMatchObject({ countries: ['Italy'], uniqueCount: 1, total: 2 });
  });

  test('empty input -> 0%, no countries', () => {
    expect(buildExplorerScore([])).toEqual({ countries: [], uniqueCount: 0, total: 0, pct: 0 });
  });
});

describe('buildNewCountriesThisYear', () => {
  test('a country whose earliest tasting falls in the target year is "new"', () => {
    const drinks = [{ id: 'a', country: 'Chile', tastings: [{ date: '10/03/2026' }] }];
    expect(buildNewCountriesThisYear(drinks, 2026)).toEqual([{ country: 'Chile', firstTasted: 'Mar 2026' }]);
  });

  test('a country first tasted in an earlier year is not "new" this year, even if re-tasted this year', () => {
    const drinks = [{ id: 'a', country: 'Italy', tastings: [{ date: '01/01/2024' }, { date: '01/01/2026' }] }];
    expect(buildNewCountriesThisYear(drinks, 2026)).toEqual([]);
  });

  test('drinks with no country or no parseable tasting date are skipped', () => {
    const drinks = [{ id: 'a', tastings: [{ date: '01/01/2026' }] }, { id: 'b', country: 'Spain', tastings: [] }];
    expect(buildNewCountriesThisYear(drinks, 2026)).toEqual([]);
  });
});

describe('buildNewStylesThisYear', () => {
  test('groups wine by variety and beer by style, tagged with category', () => {
    const drinks = [
      { id: 'a', _category: 'wine', variety: ['Nebbiolo'], tastings: [{ date: '01/06/2026' }] },
      { id: 'b', _category: 'beer', style: 'IPA', tastings: [{ date: '01/06/2026' }] },
    ];
    expect(buildNewStylesThisYear(drinks, 2026)).toEqual([
      { category: 'beer', style: 'IPA', firstTasted: 'Jun 2026' },
      { category: 'wine', style: 'Nebbiolo', firstTasted: 'Jun 2026' },
    ]);
  });

  test('others category\'s "-" placeholder style is skipped', () => {
    const drinks = [{ id: 'a', _category: 'others', style: '-', tastings: [{ date: '01/06/2026' }] }];
    expect(buildNewStylesThisYear(drinks, 2026)).toEqual([]);
  });

  test('a style first tasted in an earlier year is not "new" this year', () => {
    const drinks = [{ id: 'a', _category: 'beer', style: 'Stout', tastings: [{ date: '01/01/2024' }] }];
    expect(buildNewStylesThisYear(drinks, 2026)).toEqual([]);
  });
});

describe('buildDrinksToRevisit', () => {
  const now = new Date('2026-07-07');

  test('high-rated and last tasted over a year ago -> included', () => {
    const drinks = [{ id: 'a', producer: 'P', seriesAndName: 'Old Favorite', _category: 'wine', avgRating: 9, lastTasted: '01/01/2024' }];
    expect(buildDrinksToRevisit(drinks, { now })).toMatchObject([{ id: 'a', label: 'P Old Favorite', avgRating: 9, lastTasted: '01/01/2024' }]);
  });

  test('high-rated but tasted within the last year -> excluded', () => {
    const drinks = [{ id: 'a', avgRating: 9, lastTasted: '01/06/2026' }];
    expect(buildDrinksToRevisit(drinks, { now })).toEqual([]);
  });

  test('low-rated and old -> excluded', () => {
    const drinks = [{ id: 'a', avgRating: 5, lastTasted: '01/01/2024' }];
    expect(buildDrinksToRevisit(drinks, { now })).toEqual([]);
  });

  test('no lastTasted -> excluded', () => {
    const drinks = [{ id: 'a', avgRating: 9 }];
    expect(buildDrinksToRevisit(drinks, { now })).toEqual([]);
  });

  test('sorted oldest-lastTasted-first, avgRating desc as tiebreak', () => {
    const drinks = [
      { id: 'a', avgRating: 8, lastTasted: '01/01/2023' },
      { id: 'b', avgRating: 9, lastTasted: '01/01/2022' },
      { id: 'c', avgRating: 9.5, lastTasted: '01/01/2022' },
    ];
    expect(buildDrinksToRevisit(drinks, { now }).map(r => r.id)).toEqual(['c', 'b', 'a']);
  });

  test('empty input -> []', () => {
    expect(buildDrinksToRevisit([], { now })).toEqual([]);
  });
});
