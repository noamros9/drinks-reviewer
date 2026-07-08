import { describe, test, expect } from 'vitest';
import {
  buildPriceRatingScatter, buildAvgPriceCategoryComparison, buildAvgPriceByCountry, buildBestValue,
} from '../utils/analyticsHelpers';

describe('buildPriceRatingScatter', () => {
  test('includes drinks with both a price and a rating', () => {
    const drinks = [
      { id: 'a', producer: 'P', seriesAndName: 'X', _category: 'wine', avgRating: 8, collection: [{ price: 50 }, { price: 70 }] },
      { id: 'b', avgRating: 7, collection: [] },
      { id: 'c', collection: [{ price: 40 }] },
    ];
    const result = buildPriceRatingScatter(drinks);
    expect(result).toEqual([{ id: 'a', category: 'wine', label: 'P X', price: 60, rating: 8, drink: drinks[0] }]);
  });

  test('averages multiple lots and skips lots with no price', () => {
    const drinks = [{ id: 'a', avgRating: 8, collection: [{ price: 30 }, { price: null }, { quantity: 0, price: 90 }] }];
    expect(buildPriceRatingScatter(drinks)[0].price).toBe(60);
  });

  test('no collection field -> excluded', () => {
    expect(buildPriceRatingScatter([{ id: 'a', avgRating: 8 }])).toEqual([]);
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
  test('ranks by weighted rating ÷ avg price, descending', () => {
    const drinks = [
      { id: 'cheap-good', producer: 'A', avgRating: 8, tastingCount: 5, collection: [{ price: 20 }] },
      { id: 'pricey-good', producer: 'B', avgRating: 8, tastingCount: 5, collection: [{ price: 200 }] },
    ];
    const result = buildBestValue(drinks);
    expect(result.map(r => r.id)).toEqual(['cheap-good', 'pricey-good']);
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
});
