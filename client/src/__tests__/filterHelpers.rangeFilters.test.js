import { matchesFilters, buildInitialFilters } from '../utils/filterHelpers';

const wine = (overrides) => ({
  id: '1', producer: 'TestProd', wineCategory: 'Red', variety: 'Cabernet Sauvignon',
  country: 'France', region: 'Bordeaux', ...overrides,
});

// ── matchesFilters – ABV range ────────────────────────────────────

test('abv: drink within range passes', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set(), abvMin: '10', abvMax: '15' };
  expect(matchesFilters(wine({ abv: '12' }), filters, 'wine')).toBe(true);
});
test('abv: drink below min is excluded', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set(), abvMin: '10', abvMax: '' };
  expect(matchesFilters(wine({ abv: '8' }), filters, 'wine')).toBe(false);
});
test('abv: drink above max is excluded', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set(), abvMin: '', abvMax: '14' };
  expect(matchesFilters(wine({ abv: '16' }), filters, 'wine')).toBe(false);
});
test('abv: no abv filter passes everything', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set(), abvMin: '', abvMax: '' };
  expect(matchesFilters(wine({ abv: '99' }), filters, 'wine')).toBe(true);
});
test('abv: drink with missing/NaN abv is excluded when an abv filter is active', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set(), abvMin: '10', abvMax: '15' };
  expect(matchesFilters(wine({ abv: '' }), filters, 'wine')).toBe(false);
});

test('vivinoScore: drink with no vivinoScore is excluded when a vivino filter is active', () => {
  const filters = { ...buildInitialFilters('wine'), vivinoScoreMin: '4' };
  expect(matchesFilters(wine(), filters, 'wine')).toBe(false);
});

// ── matchesFilters – avg rating range (all categories) ────────────

test('avgRating: drink within range passes', () => {
  const filters = { ...buildInitialFilters('wine'), avgRatingMin: '7', avgRatingMax: '9' };
  expect(matchesFilters(wine({ avgRating: '8' }), filters, 'wine')).toBe(true);
});

test('avgRating: drink below min is excluded', () => {
  const filters = { ...buildInitialFilters('wine'), avgRatingMin: '7' };
  expect(matchesFilters(wine({ avgRating: '5' }), filters, 'wine')).toBe(false);
});

test('avgRating: filters on beer too (applies to all categories)', () => {
  const beer = { id: '1', brewery: 'B', name: 'N', style: 'IPA', country: 'DE', avgRating: '5' };
  const filters = { producerSearch: '', avgRatingMin: '7' };
  expect(matchesFilters(beer, filters, 'beer')).toBe(false);
});

// ── matchesFilters – vivino score range (wine only) ───────────────

test('vivinoScore: drink within range passes on wine', () => {
  const filters = { ...buildInitialFilters('wine'), vivinoScoreMin: '4' };
  expect(matchesFilters(wine({ vivinoScore: 4.2 }), filters, 'wine')).toBe(true);
});

test('vivinoScore: drink below min is excluded on wine', () => {
  const filters = { ...buildInitialFilters('wine'), vivinoScoreMin: '4' };
  expect(matchesFilters(wine({ vivinoScore: 3.5 }), filters, 'wine')).toBe(false);
});

test('vivinoScore filter is not defined for beer (no RANGE_FILTER_CONFIGS.beer entry)', () => {
  const beer = { id: '1', brewery: 'B', name: 'N', style: 'IPA', country: 'DE', vivinoScore: 1 };
  const filters = { producerSearch: '', vivinoScoreMin: '4' };
  expect(matchesFilters(beer, filters, 'beer')).toBe(true);
});

// ── buildInitialFilters – range keys per category ─────────────────

test('buildInitialFilters wine: includes avgRating and vivinoScore range keys', () => {
  const filters = buildInitialFilters('wine');
  expect(filters.avgRatingMin).toBe('');
  expect(filters.avgRatingMax).toBe('');
  expect(filters.vivinoScoreMin).toBe('');
  expect(filters.vivinoScoreMax).toBe('');
});

test('buildInitialFilters beer: includes avgRating but not vivinoScore range keys', () => {
  const filters = buildInitialFilters('beer');
  expect(filters.avgRatingMin).toBe('');
  expect('vivinoScoreMin' in filters).toBe(false);
});
