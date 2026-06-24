import { matchesFilters, buildDropdownOptions, splitVarieties, isBlend, OLD_WORLD, NEW_WORLD } from '../utils/filterHelpers';

const wine = (overrides) => ({
  id: '1', producer: 'TestProd', wineCategory: 'Red', variety: 'Cabernet Sauvignon',
  country: 'France', region: 'Bordeaux', ...overrides,
});

// ── splitVarieties ───────────────────────────────────────────────

test('splitVarieties splits on slash', () => {
  expect(splitVarieties('Cabernet/Merlot')).toEqual(['Cabernet', 'Merlot']);
});
test('splitVarieties splits on comma', () => {
  expect(splitVarieties('Merlot, Cabernet Sauvignon, Malbec')).toEqual(['Merlot', 'Cabernet Sauvignon', 'Malbec']);
});
test('splitVarieties splits on " and "', () => {
  expect(splitVarieties('Syrah and Grenache')).toEqual(['Syrah', 'Grenache']);
});
test('splitVarieties splits on " & "', () => {
  expect(splitVarieties('Syrah & Grenache')).toEqual(['Syrah', 'Grenache']);
});
test('splitVarieties returns single-element array for single variety', () => {
  expect(splitVarieties('Chardonnay')).toEqual(['Chardonnay']);
});
test('splitVarieties returns empty array for empty/null input', () => {
  expect(splitVarieties('')).toEqual([]);
  expect(splitVarieties(null)).toEqual([]);
});

// ── isBlend ──────────────────────────────────────────────────────

test('isBlend: slash-separated = blend', () => {
  expect(isBlend('Cabernet/Merlot')).toBe(true);
});
test('isBlend: comma-separated = blend', () => {
  expect(isBlend('Syrah, Grenache')).toBe(true);
});
test('isBlend: single variety = not a blend', () => {
  expect(isBlend('Chardonnay')).toBe(false);
});
test('isBlend: "Bordeaux Blend" is a single token = not a blend', () => {
  expect(isBlend('Bordeaux Blend')).toBe(false);
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

// ── matchesFilters – variety matching (exact per-grape) ──────────

test('variety: exact match on single variety', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Cabernet Sauvignon']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet Sauvignon' }), filters, 'wine')).toBe(true);
});
test('variety: exact match — "Cabernet" does NOT match "Cabernet Sauvignon"', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Cabernet']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet Sauvignon' }), filters, 'wine')).toBe(false);
});
test('variety: selecting a grape matches a blend containing it', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Cabernet Sauvignon']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Merlot, Cabernet Sauvignon, Malbec' }), filters, 'wine')).toBe(true);
});
test('variety: Blend matches slash-separated variety', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Blend']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet/Merlot' }), filters, 'wine')).toBe(true);
});
test('variety: Blend matches comma-separated variety', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Blend']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Merlot, Cabernet Sauvignon' }), filters, 'wine')).toBe(true);
});
test('variety: Single Variety matches single grape', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Single Variety']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Chardonnay' }), filters, 'wine')).toBe(true);
});
test('variety: Single Variety excludes blends', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Single Variety']), region: new Set() };
  expect(matchesFilters(wine({ variety: 'Cabernet/Merlot' }), filters, 'wine')).toBe(false);
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
test('buildDropdownOptions variety: emits individual grape names, not raw combos', () => {
  const drinks = [
    wine({ variety: 'Merlot, Cabernet Sauvignon' }),
    wine({ variety: 'Chardonnay' }),
  ];
  const { options, special } = buildDropdownOptions(drinks, { key: 'variety', varietyGroups: true });
  expect(options).toContain('Merlot');
  expect(options).toContain('Cabernet Sauvignon');
  expect(options).toContain('Chardonnay');
  expect(options).not.toContain('Merlot, Cabernet Sauvignon');
  expect(special).toContain('Blend');
  expect(special).toContain('Single Variety');
});

test('buildDropdownOptions country for beer: no Old/New World special options', () => {
  const beer = (c) => ({ id: '1', brewery: 'B', name: 'N', style: 'IPA', country: c, abv: '5' });
  const drinks = [beer('Germany'), beer('USA')];
  const { special } = buildDropdownOptions(drinks, { key: 'country' });
  expect(special).not.toContain('Old World');
  expect(special).not.toContain('New World');
});

// ── OLD_WORLD / NEW_WORLD lists ───────────────────────────────────

test('Israel is in OLD_WORLD', () => expect(OLD_WORLD).toContain('Israel'));
test('Australia is in NEW_WORLD', () => expect(NEW_WORLD).toContain('Australia'));
test('USA is in NEW_WORLD', () => expect(NEW_WORLD).toContain('USA'));
