import { describe, test, expect } from 'vitest';
import {
  buildPriceRatingScatter, buildAvgPriceCategoryComparison, buildAvgPriceByCountry, buildBestValue, avgLotPrice, priceIsEstimated,
  buildCategoryComparison,
} from '../utils/analyticsHelpers';

describe('buildPriceRatingScatter', () => {
  test('includes drinks with both a price and a rating', () => {
    const drinks = [
      { id: 'a', producer: 'P', seriesAndName: 'X', _category: 'wine', avgRating: 8, collection: [{ price: 50 }, { price: 70 }] },
      { id: 'b', avgRating: 7, collection: [] },
      { id: 'c', collection: [{ price: 40 }] },
    ];
    const result = buildPriceRatingScatter(drinks);
    expect(result).toEqual([{ id: 'a', category: 'wine', label: 'P X', price: 60, rating: 8, priceIsEstimated: false, drink: drinks[0] }]);
  });

  test('averages multiple lots and skips lots with no price', () => {
    const drinks = [{ id: 'a', avgRating: 8, collection: [{ price: 30 }, { price: null }, { quantity: 0, price: 90 }] }];
    expect(buildPriceRatingScatter(drinks)[0].price).toBe(60);
  });

  test('no collection field -> excluded', () => {
    expect(buildPriceRatingScatter([{ id: 'a', avgRating: 8 }])).toEqual([]);
  });

  test('falls back to estimatedPrice and flags it', () => {
    const drinks = [{ id: 'a', avgRating: 8, collection: [], estimatedPrice: 45 }];
    const result = buildPriceRatingScatter(drinks);
    expect(result[0].price).toBe(45);
    expect(result[0].priceIsEstimated).toBe(true);
  });
});

describe('avgLotPrice', () => {
  test('falls back to estimatedPrice when no real lot price exists', () => {
    expect(avgLotPrice({ collection: [], estimatedPrice: 30 })).toBe(30);
  });

  test('real lot price wins when both are present', () => {
    expect(avgLotPrice({ collection: [{ price: 50 }], estimatedPrice: 30 })).toBe(50);
  });

  test('null when neither exists', () => {
    expect(avgLotPrice({ collection: [] })).toBeNull();
  });
});

describe('priceIsEstimated', () => {
  test('true when only estimatedPrice is set', () => {
    expect(priceIsEstimated({ collection: [], estimatedPrice: 30 })).toBe(true);
  });

  test('false when a real lot price exists', () => {
    expect(priceIsEstimated({ collection: [{ price: 50 }], estimatedPrice: 30 })).toBe(false);
  });

  test('false when neither exists', () => {
    expect(priceIsEstimated({ collection: [] })).toBe(false);
  });
});

describe('buildAvgPriceCategoryComparison', () => {
  test('includes all 4 categories, price-less categories at 0', () => {
    const drinks = [
      { _category: 'wine', collection: [{ price: 100 }] },
      { _category: 'wine', collection: [{ price: 200 }] },
      { _category: 'beer', collection: [{ price: 20 }] },
    ];
    const result = buildAvgPriceCategoryComparison(drinks);
    const byCategory = Object.fromEntries(result.map(r => [r.category, r]));
    expect(byCategory.wine).toEqual({ category: 'wine', avgPrice: 150, count: 2 });
    expect(byCategory.beer).toEqual({ category: 'beer', avgPrice: 20, count: 1 });
    expect(byCategory.whiskey).toEqual({ category: 'whiskey', avgPrice: 0, count: 0 });
  });
});

describe('buildAvgPriceByCountry', () => {
  test('averages per-drink price within each country', () => {
    const drinks = [
      { country: 'France', collection: [{ price: 100 }] },
      { country: 'France', collection: [{ price: 200 }] },
      { country: 'Italy', collection: [{ price: 50 }] },
      { country: 'Spain', collection: [] },
    ];
    const result = buildAvgPriceByCountry(drinks);
    const byCountry = Object.fromEntries(result.map(r => [r.country, r]));
    expect(byCountry.France).toEqual({ country: 'France', avgPrice: 150, count: 2 });
    expect(byCountry.Italy).toEqual({ country: 'Italy', avgPrice: 50, count: 1 });
    expect(byCountry.Spain).toBeUndefined();
  });

  test('empty input -> []', () => {
    expect(buildAvgPriceByCountry([])).toEqual([]);
  });
});

describe('buildBestValue', () => {
  test('ranks by rating percentile minus price percentile within category, descending', () => {
    const drinks = [
      { id: 'cheap-good', producer: 'A', avgRating: 8, tastingCount: 5, collection: [{ price: 20 }] },
      { id: 'pricey-good', producer: 'B', avgRating: 8, tastingCount: 5, collection: [{ price: 200 }] },
    ];
    const result = buildBestValue(drinks);
    expect(result.map(r => r.id)).toEqual(['cheap-good', 'pricey-good']);
    expect(result.find(r => r.id === 'cheap-good').valueScore).toBe(62.5);
    expect(result.find(r => r.id === 'pricey-good').valueScore).toBe(37.5);
  });

  test('excludes drinks with no price', () => {
    const drinks = [{ id: 'a', avgRating: 8, tastingCount: 5 }];
    expect(buildBestValue(drinks)).toEqual([]);
  });

  test('excludes drinks with no rating (no weighted rating available)', () => {
    const drinks = [{ id: 'a', collection: [{ price: 20 }] }];
    expect(buildBestValue(drinks)).toEqual([]);
  });

  test('respects n and empty input', () => {
    const drinks = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`, avgRating: 5 + (i % 5), tastingCount: 3, collection: [{ price: 10 + i }],
    }));
    expect(buildBestValue(drinks, 3)).toHaveLength(3);
    expect(buildBestValue([])).toEqual([]);
  });

  test('an expensive-but-cheap-for-its-category wine outranks a merely-average beer (cross-category comparability)', () => {
    const drinks = [
      // Wines: prices 50-500, this one is the cheapest and best-rated of its category
      { id: 'good-wine', _category: 'wine', avgRating: 9, tastingCount: 5, collection: [{ price: 50 }] },
      { id: 'mid-wine-1', _category: 'wine', avgRating: 7, tastingCount: 5, collection: [{ price: 300 }] },
      { id: 'mid-wine-2', _category: 'wine', avgRating: 7, tastingCount: 5, collection: [{ price: 500 }] },
      // Beers: prices 3-10, this one is merely mid-pack for its category
      { id: 'avg-beer', _category: 'beer', avgRating: 7, tastingCount: 5, collection: [{ price: 6 }] },
      { id: 'cheap-beer', _category: 'beer', avgRating: 6, tastingCount: 5, collection: [{ price: 3 }] },
      { id: 'pricey-beer', _category: 'beer', avgRating: 6, tastingCount: 5, collection: [{ price: 10 }] },
    ];
    const result = buildBestValue(drinks);
    const wineRank = result.findIndex(r => r.id === 'good-wine');
    const beerRank = result.findIndex(r => r.id === 'avg-beer');
    expect(wineRank).toBeLessThan(beerRank);
  });

  test('a lone priced drink in a category gets valueScore 50 (neutral), no division-by-zero', () => {
    const drinks = [{ id: 'a', _category: 'whiskey', avgRating: 8, tastingCount: 5, collection: [{ price: 100 }] }];
    expect(buildBestValue(drinks)[0].valueScore).toBe(50);
  });

  test('rows carry categoryAvgPrice/categoryAvgRating matching the category comparison helpers', () => {
    const drinks = [
      { id: 'a', _category: 'wine', avgRating: 8, tastingCount: 5, collection: [{ price: 20 }] },
      { id: 'b', _category: 'wine', avgRating: 6, tastingCount: 5, collection: [{ price: 40 }] },
    ];
    const result = buildBestValue(drinks);
    const expectedAvgPrice = buildAvgPriceCategoryComparison(drinks).find(r => r.category === 'wine').avgPrice;
    const expectedAvgRating = buildCategoryComparison(drinks).find(r => r.category === 'wine').avgRating;
    for (const row of result) {
      expect(row.categoryAvgPrice).toBe(expectedAvgPrice);
      expect(row.categoryAvgRating).toBe(expectedAvgRating);
    }
  });
});
