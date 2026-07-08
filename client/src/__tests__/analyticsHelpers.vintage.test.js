import { describe, test, expect } from 'vitest';
import { buildVintageLeaderboard, buildAgeVsRatingScatter } from '../utils/analyticsHelpers';

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
