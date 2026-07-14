import { matchesFilters, buildDropdownOptions, countOptions, isBlend, buildInitialFilters, OLD_WORLD, NEW_WORLD, applyUrlDropdownOverrides, applyUrlProducerOverride } from '../utils/filterHelpers';

const wine = (overrides) => ({
  id: '1', producer: 'TestProd', wineCategory: 'Red', variety: ['Cabernet Sauvignon'],
  country: 'France', region: 'Bordeaux', ...overrides,
});

// ── isBlend ──────────────────────────────────────────────────────

test('isBlend: multi-element array = blend', () => {
  expect(isBlend(['Cabernet', 'Merlot'])).toBe(true);
});
test('isBlend: single-element array = not a blend', () => {
  expect(isBlend(['Chardonnay'])).toBe(false);
});
test('isBlend: empty/null = not a blend', () => {
  expect(isBlend([])).toBe(false);
  expect(isBlend(null)).toBe(false);
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
  expect(matchesFilters(wine({ variety: ['Cabernet Sauvignon'] }), filters, 'wine')).toBe(true);
});
test('variety: exact match — "Cabernet" does NOT match "Cabernet Sauvignon"', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Cabernet']), region: new Set() };
  expect(matchesFilters(wine({ variety: ['Cabernet Sauvignon'] }), filters, 'wine')).toBe(false);
});
test('variety: selecting a grape matches a blend containing it', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Cabernet Sauvignon']), region: new Set() };
  expect(matchesFilters(wine({ variety: ['Merlot', 'Cabernet Sauvignon', 'Malbec'] }), filters, 'wine')).toBe(true);
});
test('variety: Blend matches multi-element variety array', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Blend']), region: new Set() };
  expect(matchesFilters(wine({ variety: ['Cabernet', 'Merlot'] }), filters, 'wine')).toBe(true);
});
test('variety: Single Variety matches single grape', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Single Variety']), region: new Set() };
  expect(matchesFilters(wine({ variety: ['Chardonnay'] }), filters, 'wine')).toBe(true);
});
test('variety: Single Variety excludes blends', () => {
  const filters = { producerSearch: '', wineCategory: new Set(), country: new Set(), variety: new Set(['Single Variety']), region: new Set() };
  expect(matchesFilters(wine({ variety: ['Cabernet', 'Merlot'] }), filters, 'wine')).toBe(false);
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
    wine({ variety: ['Merlot', 'Cabernet Sauvignon'] }),
    wine({ variety: ['Chardonnay'] }),
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
    wine({ variety: ['Merlot', 'Cabernet Sauvignon'] }),
    wine({ variety: ['Chardonnay'] }),
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


// ── buildInitialFilters – unknown category ────────────────────────

test('buildInitialFilters: unknown category returns base fields only (|| [] fallback)', () => {
  const filters = buildInitialFilters('unknown');
  expect(filters.producerSearch).toBe('');
  // No range or dropdown keys should be added
  expect(Object.keys(filters)).toEqual(['producerSearch']);
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

// ── vintage filter (vintageFromTastings) ─────────────────────────

const VINTAGE_CONF = { key: 'vintage', label: 'Vintage', vintageFromTastings: true };

function wineWithTastings(vintages) {
  return wine({
    tastings: vintages.map(v => ({ id: 'x', date: '01/01/2024', rating: 8, vintage: v })),
  });
}

test('matchesFilters vintage: matches when any tasting vintage is selected', () => {
  const filters = buildInitialFilters('wine');
  filters.vintage = new Set(['2021']);
  const drink = wineWithTastings(['2019', '2021']);
  expect(matchesFilters(drink, filters, 'wine')).toBe(true);
});

test('matchesFilters vintage: excludes drink when no tasting matches', () => {
  const filters = buildInitialFilters('wine');
  filters.vintage = new Set(['2022']);
  const drink = wineWithTastings(['2019', '2021']);
  expect(matchesFilters(drink, filters, 'wine')).toBe(false);
});

test('matchesFilters vintage: passes when filter is empty', () => {
  const filters = buildInitialFilters('wine');
  const drink = wineWithTastings(['2021']);
  expect(matchesFilters(drink, filters, 'wine')).toBe(true);
});

test('matchesFilters vintage: excludes drink with no tastings when vintage filter is active', () => {
  const filters = buildInitialFilters('wine');
  filters.vintage = new Set(['2021']);
  expect(matchesFilters(wine(), filters, 'wine')).toBe(false);
});

test('buildDropdownOptions vintageFromTastings: collects all unique vintages across tastings', () => {
  const drinks = [wineWithTastings(['2019', '2021']), wineWithTastings(['2021', '2022'])];
  const { options } = buildDropdownOptions(drinks, VINTAGE_CONF);
  expect(options).toEqual(['2019', '2021', '2022']);
});

test('countOptions vintageFromTastings: counts wines per unique vintage', () => {
  const drinks = [wineWithTastings(['2019', '2021']), wineWithTastings(['2021'])];
  const filters = buildInitialFilters('wine');
  const counts = countOptions(drinks, VINTAGE_CONF, filters, 'wine');
  expect(counts['2019']).toBe(1);
  expect(counts['2021']).toBe(2);
  expect(counts['2022']).toBeUndefined();
});

describe('applyUrlDropdownOverrides', () => {
  test('adds a URL param value into the matching dropdown filter Set', () => {
    const filters = buildInitialFilters('wine');
    const result = applyUrlDropdownOverrides(filters, new URLSearchParams('country=Italy'), 'wine');
    expect(result.country).toEqual(new Set(['Italy']));
  });

  test('merges with existing Set members rather than replacing them', () => {
    const filters = { ...buildInitialFilters('wine'), country: new Set(['France']) };
    const result = applyUrlDropdownOverrides(filters, new URLSearchParams('country=Italy'), 'wine');
    expect(result.country).toEqual(new Set(['France', 'Italy']));
  });

  test('a param key not present in that category\'s DROPDOWN_CONFIGS is a no-op', () => {
    const filters = buildInitialFilters('beer');
    const result = applyUrlDropdownOverrides(filters, new URLSearchParams('region=Speyside'), 'beer');
    expect(result).toEqual(filters);
  });

  test('absent query param leaves the filter untouched', () => {
    const filters = buildInitialFilters('wine');
    const result = applyUrlDropdownOverrides(filters, new URLSearchParams(''), 'wine');
    expect(result).toEqual(filters);
  });
});

describe('applyUrlProducerOverride', () => {
  test('sets producerSearch from a ?producer= param', () => {
    const filters = buildInitialFilters('wine');
    const result = applyUrlProducerOverride(filters, new URLSearchParams('producer=Chateau'));
    expect(result.producerSearch).toBe('Chateau');
  });

  test('absent query param leaves the filters untouched', () => {
    const filters = buildInitialFilters('wine');
    const result = applyUrlProducerOverride(filters, new URLSearchParams(''));
    expect(result).toEqual(filters);
  });
});
