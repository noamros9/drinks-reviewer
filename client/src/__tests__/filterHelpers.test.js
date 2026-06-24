import { matchesFilters, buildDropdownOptions, isBlend, OLD_WORLD, NEW_WORLD } from '../utils/filterHelpers';

const wine = (overrides) => ({
  id: '1', producer: 'TestProd', wineCategory: 'Red', variety: 'Cabernet Sauvignon',
  country: 'France', region: 'Bordeaux', ...overrides,
});

// ── isBlend ──────────────────────────────────────────────────────

test('isBlend detects slash-separated varieties', () => {
  expect(isBlend('Cabernet/Merlot')).toBe(true);
});
test('isBlend detects the word blend', () => {
  expect(isBlend('Bordeaux Blend')).toBe(true);
});
test('isBlend detects comma-separated varieties', () => {
  expect(isBlend('Syrah, Grenache')).toBe(true);
});
test('isBlend returns false for single variety', () => {
  expect(isBlend('Chardonnay')).toBe(false);
});

// ── matchesFilters – producer search ────────────────────────────

test('producer search: matches substring case-insensitively', () => {
  const filters = { producerSearch: 'test', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set() };
  expect(matchesFilters(wine(), filters, 'wine')).toBe(true);
});
test('producer search: excludes non-matching producer', () => {
  const filters = { producerSearch: 'xyz', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set() };
  expect(matchesFilters(wine(), filters, 'wine')).toBe(false);
});

// ── matchesFilters – country groups ─────────────────────────────

test('country: Old World matches French wine', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(['Old World']), variety: new Set(), region: new Set() };
  expect(matchesFilters(wine({ country: 'France' }), filters, 'wine')).toBe(true);
});
test('country: New World matches Australian wine', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(['New World']), variety: new Set(), region: new Set() };
  expect(matchesFilters(wine({ country: 'Australia' }), filters, 'wine')).toBe(true);
});
test('country: Old World does not match Australian wine', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(['Old World']), variety: new Set(), region: new Set() };
  expect(matchesFilters(wine({ country: 'Australia' }), filters, 'wine')).toBe(false);
});
test('country: Other matches country not in any group', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(['Other']), variety: new Set(), region: new Set() };
  expect(matchesFilters(wine({ country: 'UnknownLand' }), filters, 'wine')).toBe(true);
});

// ── matchesFilters – variety matching ───────────────────────────

test('variety: partial match — selecting Cabernet matches Cabernet Sauvignon', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Cabernet']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet Sauvignon' }), filters, 'wine')).toBe(true);
});
test('variety: Blend special option matches slash variety', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Blend']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet/Merlot' }), filters, 'wine')).toBe(true);
});
test('variety: Single Variety excludes blends', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Single Variety']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet/Merlot' }), filters, 'wine')).toBe(false);
  expect(matchesFilters(wine({ variety: 'Chardonnay' }), filters, 'wine')).toBe(true);
});

// ── buildDropdownOptions ─────────────────────────────────────────

test('buildDropdownOptions returns Old/New World special options for country', () => {
  const drinks = [wine({ country: 'France' }), wine({ country: 'Australia' })];
  const { special } = buildDropdownOptions(drinks, { key: 'country', worldGroups: true });
  expect(special).toContain('Old World');
  expect(special).toContain('New World');
});
test('buildDropdownOptions adds Other when unknown country present', () => {
  const drinks = [wine({ country: 'UnknownLand' })];
  const { special } = buildDropdownOptions(drinks, { key: 'country', worldGroups: true });
  expect(special).toContain('Other');
});
test('buildDropdownOptions adds Blend/Single Variety for variety', () => {
  const drinks = [wine({ variety: 'Cabernet/Merlot' }), wine({ variety: 'Chardonnay' })];
  const { special } = buildDropdownOptions(drinks, { key: 'variety', varietyGroups: true });
  expect(special).toContain('Blend');
  expect(special).toContain('Single Variety');
});

// ── OLD_WORLD / NEW_WORLD lists include expected countries ───────

test('Israel is in OLD_WORLD', () => expect(OLD_WORLD).toContain('Israel'));
test('Australia is in NEW_WORLD', () => expect(NEW_WORLD).toContain('Australia'));
test('USA is in NEW_WORLD', () => expect(NEW_WORLD).toContain('USA'));
