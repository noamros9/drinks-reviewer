import { matchesFilters, buildDropdownOptions, countOptions, splitVarieties, isBlend, buildInitialFilters, OLD_WORLD, NEW_WORLD } from '../utils/filterHelpers';

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

// ── countOptions ─────────────────────────────────────────────────

const noFilters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set() };

test('countOptions: basic type counts with no active filters', () => {
  const drinks = [wine({ wineCategory: 'Red' }), wine({ wineCategory: 'Red' }), wine({ wineCategory: 'White' })];
  const conf = { key: 'wineCategory', label: 'Type' };
  const counts = countOptions(drinks, conf, noFilters, 'wine');
  expect(counts['Red']).toBe(2);
  expect(counts['White']).toBe(1);
});

test('countOptions: contextual — other active filters narrow the count', () => {
  const drinks = [
    wine({ wineCategory: 'Red', country: 'France' }),
    wine({ wineCategory: 'Red', country: 'Australia' }),
    wine({ wineCategory: 'White', country: 'France' }),
  ];
  const conf = { key: 'wineCategory', label: 'Type' };
  const filters = { ...noFilters, country: new Set(['France']) };
  const counts = countOptions(drinks, conf, filters, 'wine');
  expect(counts['Red']).toBe(1);
  expect(counts['White']).toBe(1);
});

test('countOptions: producer search narrows counts', () => {
  const drinks = [
    wine({ producer: 'Latroun', wineCategory: 'Red' }),
    wine({ producer: 'Other', wineCategory: 'Red' }),
    wine({ producer: 'Latroun', wineCategory: 'White' }),
  ];
  const conf = { key: 'wineCategory', label: 'Type' };
  const filters = { ...noFilters, producerSearch: 'Latroun' };
  const counts = countOptions(drinks, conf, filters, 'wine');
  expect(counts['Red']).toBe(1);
  expect(counts['White']).toBe(1);
});

test('countOptions: worldGroups — counts Old/New World and individual countries', () => {
  const drinks = [wine({ country: 'France' }), wine({ country: 'Italy' }), wine({ country: 'Australia' })];
  const conf = { key: 'country', label: 'Country', worldGroups: true };
  const counts = countOptions(drinks, conf, noFilters, 'wine');
  expect(counts['Old World']).toBe(2);
  expect(counts['New World']).toBe(1);
  expect(counts['France']).toBe(1);
  expect(counts['Australia']).toBe(1);
});

test('countOptions: varietyGroups — counts Blend, Single Variety, and individual grapes', () => {
  const drinks = [
    wine({ variety: 'Merlot, Cabernet Sauvignon' }),
    wine({ variety: 'Chardonnay' }),
  ];
  const conf = { key: 'variety', label: 'Variety', varietyGroups: true };
  const counts = countOptions(drinks, conf, noFilters, 'wine');
  expect(counts['Blend']).toBe(1);
  expect(counts['Single Variety']).toBe(1);
  expect(counts['Merlot']).toBe(1);
  expect(counts['Cabernet Sauvignon']).toBe(1);
  expect(counts['Chardonnay']).toBe(1);
});

// ── matchesFilters – simple (non-country, non-variety) filter ────

test('wineCategory filter excludes non-matching type', () => {
  const filters = { producerSearch: '', wineCategory: new Set(['Red']), country: new Set(), variety: new Set(), region: new Set(), abvMin: '', abvMax: '' };
  expect(matchesFilters(wine({ wineCategory: 'White' }), filters, 'wine')).toBe(false);
});

test('wineCategory filter passes matching type', () => {
  const filters = { producerSearch: '', wineCategory: new Set(['Red']), country: new Set(), variety: new Set(), region: new Set(), abvMin: '', abvMax: '' };
  expect(matchesFilters(wine({ wineCategory: 'Red' }), filters, 'wine')).toBe(true);
});

test('abv: drink with NaN abv is not excluded by abv filter', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(), region: new Set(), abvMin: '10', abvMax: '15' };
  expect(matchesFilters(wine({ abv: '' }), filters, 'wine')).toBe(true);
});

// ── countOptions – worldGroups Other branch ───────────────────────

test('countOptions worldGroups: country in neither OLD nor NEW is counted as Other', () => {
  const drinks = [wine({ country: 'UnknownLand' })];
  const conf = { key: 'country', label: 'Country', worldGroups: true };
  const counts = countOptions(drinks, conf, noFilters, 'wine');
  expect(counts['Other']).toBe(1);
  expect(counts['UnknownLand']).toBe(1);
});

// ── OLD_WORLD / NEW_WORLD lists ───────────────────────────────────

test('Israel is in OLD_WORLD', () => expect(OLD_WORLD).toContain('Israel'));
test('Australia is in NEW_WORLD', () => expect(NEW_WORLD).toContain('Australia'));
test('USA is in NEW_WORLD', () => expect(NEW_WORLD).toContain('USA'));

// ── matchesFilters – unknown category ────────────────────────────

test('matchesFilters: unknown category with no producerSearch passes (|| [] fallback)', () => {
  const filters = { producerSearch: '', abvMin: '', abvMax: '' };
  expect(matchesFilters(wine(), filters, 'unknown')).toBe(true);
});

test('matchesFilters: unknown category with producerSearch hits ?? fallback for producerField', () => {
  // PRODUCER_FIELD['unknown'] = undefined → drink[undefined] = undefined → ?? '' = ''
  // '' does not include 'xyz' → returns false
  const filters = { producerSearch: 'xyz', abvMin: '', abvMax: '' };
  expect(matchesFilters(wine(), filters, 'unknown')).toBe(false);
});

// ── buildInitialFilters – unknown category ────────────────────────

test('buildInitialFilters: unknown category returns base fields only (|| [] fallback)', () => {
  const filters = buildInitialFilters('unknown');
  expect(filters.producerSearch).toBe('');
  expect(filters.abvMin).toBe('');
  expect(filters.abvMax).toBe('');
  // No dropdown keys should be added
  expect(Object.keys(filters)).toEqual(['producerSearch', 'abvMin', 'abvMax']);
});

// ── sweetness filter ──────────────────────────────────────────────

test('sweetness: matches wine with selected sweetness', () => {
  const filters = buildInitialFilters('wine');
  filters.sweetness = new Set(['Dry']);
  expect(matchesFilters(wine({ sweetness: 'Dry' }), filters, 'wine')).toBe(true);
});

test('sweetness: excludes wine with different sweetness', () => {
  const filters = buildInitialFilters('wine');
  filters.sweetness = new Set(['Dry']);
  expect(matchesFilters(wine({ sweetness: 'Sweet' }), filters, 'wine')).toBe(false);
});

// ── tags filter (multiValue) ──────────────────────────────────────

test('tags: matches drink when any selected tag is in drink.tags', () => {
  const filters = buildInitialFilters('wine');
  filters.tags = new Set(['gift']);
  expect(matchesFilters(wine({ tags: ['gift', 'organic'] }), filters, 'wine')).toBe(true);
});

test('tags: excludes drink when no selected tag is in drink.tags', () => {
  const filters = buildInitialFilters('wine');
  filters.tags = new Set(['cellar']);
  expect(matchesFilters(wine({ tags: ['gift'] }), filters, 'wine')).toBe(false);
});

test('tags: passes when drink has no tags and tag filter is empty', () => {
  const filters = buildInitialFilters('wine');
  expect(matchesFilters(wine({ tags: [] }), filters, 'wine')).toBe(true);
});

test('tags: passes when drink.tags is undefined and no filter active', () => {
  const filters = buildInitialFilters('wine');
  expect(matchesFilters(wine(), filters, 'wine')).toBe(true);
});

test('tags: excludes drink with undefined tags when filter is active', () => {
  const filters = buildInitialFilters('wine');
  filters.tags = new Set(['gift']);
  expect(matchesFilters(wine(), filters, 'wine')).toBe(false);
});

// ── buildDropdownOptions – multiValue (tags) ──────────────────────

test('buildDropdownOptions tags: flattens arrays into unique sorted options', () => {
  const drinks = [
    wine({ tags: ['gift', 'organic'] }),
    wine({ tags: ['organic', 'cellar'] }),
  ];
  const { special, options } = buildDropdownOptions(drinks, { key: 'tags', multiValue: true });
  expect(special).toEqual([]);
  expect(options).toEqual(['cellar', 'gift', 'organic']);
});

test('buildDropdownOptions tags: handles drinks with no tags', () => {
  const drinks = [wine({ tags: [] }), wine()];
  const { options } = buildDropdownOptions(drinks, { key: 'tags', multiValue: true });
  expect(options).toEqual([]);
});

// ── countOptions – multiValue (tags) ─────────────────────────────

test('countOptions tags: counts each tag individually', () => {
  const drinks = [
    wine({ tags: ['gift', 'organic'] }),
    wine({ tags: ['gift'] }),
  ];
  const conf = { key: 'tags', label: 'Tags', multiValue: true };
  const filters = buildInitialFilters('wine');
  const counts = countOptions(drinks, conf, filters, 'wine');
  expect(counts['gift']).toBe(2);
  expect(counts['organic']).toBe(1);
});

// ── buildInitialFilters includes sweetness and tags for wine ──────

test('buildInitialFilters wine: includes sweetness and tags Sets', () => {
  const filters = buildInitialFilters('wine');
  expect(filters.sweetness).toBeInstanceOf(Set);
  expect(filters.tags).toBeInstanceOf(Set);
});
