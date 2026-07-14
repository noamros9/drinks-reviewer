import { describe, test, expect } from 'vitest';
import { buildStyleLeaderboard, buildUndiscovered } from '../utils/analyticsHelpers';

describe('buildStyleLeaderboard', () => {
  test('wine grape mode splits blends so each grape counts separately', () => {
    const wine = [
      { variety: ['Merlot'], avgRating: 8 },
      { variety: ['Cabernet Sauvignon', 'Merlot'], avgRating: 6 },
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
      { variety: ['Merlot'], avgRating: 7, },
      { variety: ['Merlot'], avgRating: 7 },
      { variety: ['Cabernet Sauvignon'], avgRating: 6 },
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
      { variety: ['Merlot'], avgRating: 8 },
      { variety: ['Cabernet Sauvignon', 'Merlot'], avgRating: 6 },
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
