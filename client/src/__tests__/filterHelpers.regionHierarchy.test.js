import {
  matchesFilters, buildInitialFilters, buildDropdownOptions, countOptions,
  regionLeaf, regionAncestors, flattenRegions, knownRegions, DROPDOWN_CONFIGS,
} from '../utils/filterHelpers';

const wine = (overrides) => ({
  id: '1', producer: 'TestProd', wineCategory: 'Red', variety: ['Cabernet Sauvignon'],
  country: 'France', region: 'Bordeaux', ...overrides,
});

const regionConf = DROPDOWN_CONFIGS.wine.find(c => c.key === 'region');
const withRegions = (...regions) => regions.map((region, i) => wine({ id: String(i), region }));
const filtersWithRegion = (...selected) => ({ ...buildInitialFilters('wine'), region: new Set(selected) });

// ── path helpers ──────────────────────────────────────────────────

test('regionLeaf returns the most specific segment', () => {
  expect(regionLeaf('Loire Valley / Sancerre')).toBe('Sancerre');
  expect(regionLeaf('Bourgogne / Côte de Nuits / Gevrey-Chambertin')).toBe('Gevrey-Chambertin');
  expect(regionLeaf('Rioja')).toBe('Rioja');
  expect(regionLeaf('')).toBe('');
  expect(regionLeaf(undefined)).toBe('');
});

test('regionAncestors lists every level including the full path', () => {
  expect(regionAncestors('Bourgogne / Côte de Nuits / Gevrey-Chambertin')).toEqual([
    'Bourgogne', 'Bourgogne / Côte de Nuits', 'Bourgogne / Côte de Nuits / Gevrey-Chambertin',
  ]);
  expect(regionAncestors('Rioja')).toEqual(['Rioja']);
});

// ── matching ──────────────────────────────────────────────────────

test('selecting a leaf matches only that appellation', () => {
  const filters = filtersWithRegion('Loire Valley / Sancerre');
  expect(matchesFilters(wine({ region: 'Loire Valley / Sancerre' }), filters, 'wine')).toBe(true);
  expect(matchesFilters(wine({ region: 'Loire Valley / Vouvray' }), filters, 'wine')).toBe(false);
});

test('selecting a parent matches every descendant, at any depth', () => {
  const filters = filtersWithRegion('Bourgogne');
  expect(matchesFilters(wine({ region: 'Bourgogne' }), filters, 'wine')).toBe(true);
  expect(matchesFilters(wine({ region: 'Bourgogne / Chablis' }), filters, 'wine')).toBe(true);
  expect(matchesFilters(wine({ region: 'Bourgogne / Côte de Nuits / Vosne-Romanée' }), filters, 'wine')).toBe(true);
  expect(matchesFilters(wine({ region: 'Bordeaux / Pomerol' }), filters, 'wine')).toBe(false);
});

// The guard that makes this safe: matching on the separator, not on a bare prefix.
test('a parent does not match a region that merely starts with its name', () => {
  const filters = filtersWithRegion('Toscana');
  expect(matchesFilters(wine({ region: 'Toscana Nowhere' }), filters, 'wine')).toBe(false);
  expect(matchesFilters(wine({ region: 'Toscana / Chianti' }), filters, 'wine')).toBe(true);
});

test('selecting two branches matches drinks from either', () => {
  const filters = filtersWithRegion('Toscana', 'Loire Valley / Sancerre');
  expect(matchesFilters(wine({ region: 'Toscana / Chianti' }), filters, 'wine')).toBe(true);
  expect(matchesFilters(wine({ region: 'Loire Valley / Sancerre' }), filters, 'wine')).toBe(true);
  expect(matchesFilters(wine({ region: 'Loire Valley / Vouvray' }), filters, 'wine')).toBe(false);
});

test('a drink with no region is excluded once a region filter is active', () => {
  expect(matchesFilters(wine({ region: '' }), filtersWithRegion('Toscana'), 'wine')).toBe(false);
});

// ── dropdown options ──────────────────────────────────────────────

test('buildDropdownOptions synthesizes parents that no drink sits at exactly', () => {
  const { options } = buildDropdownOptions(withRegions('Loire Valley / Sancerre'), regionConf);
  expect(options).toEqual([
    { value: 'Loire Valley', label: 'Loire Valley', depth: 0 },
    { value: 'Loire Valley / Sancerre', label: 'Sancerre', depth: 1 },
  ]);
});

test('buildDropdownOptions orders each parent immediately above its children', () => {
  const drinks = withRegions('Toscana / Chianti', 'Rioja', 'Toscana', 'Loire Valley / Sancerre');
  const { options } = buildDropdownOptions(drinks, regionConf);
  expect(options.map(o => o.value)).toEqual([
    'Loire Valley', 'Loire Valley / Sancerre', 'Rioja', 'Toscana', 'Toscana / Chianti',
  ]);
});

test('buildDropdownOptions reports depth for a three-level path', () => {
  const { options } = buildDropdownOptions(withRegions('Bourgogne / Côte de Nuits / Vosne-Romanée'), regionConf);
  expect(options.map(o => [o.label, o.depth])).toEqual([
    ['Bourgogne', 0], ['Côte de Nuits', 1], ['Vosne-Romanée', 2],
  ]);
});

test('buildDropdownOptions dedupes shared ancestors', () => {
  const drinks = withRegions('Toscana / Chianti', 'Toscana / Bolgheri');
  const { options } = buildDropdownOptions(drinks, regionConf);
  expect(options.map(o => o.value)).toEqual(['Toscana', 'Toscana / Bolgheri', 'Toscana / Chianti']);
});

// ── counts ────────────────────────────────────────────────────────

test('countOptions rolls a nested drink up into every ancestor', () => {
  const drinks = withRegions('Bourgogne / Côte de Nuits / Vosne-Romanée');
  const counts = countOptions(drinks, regionConf, buildInitialFilters('wine'), 'wine');
  expect(counts).toEqual({
    'Bourgogne': 1,
    'Bourgogne / Côte de Nuits': 1,
    'Bourgogne / Côte de Nuits / Vosne-Romanée': 1,
  });
});

test('countOptions sums siblings into their shared parent', () => {
  const drinks = withRegions('Toscana / Chianti', 'Toscana / Bolgheri', 'Toscana');
  const counts = countOptions(drinks, regionConf, buildInitialFilters('wine'), 'wine');
  expect(counts['Toscana']).toBe(3);
  expect(counts['Toscana / Chianti']).toBe(1);
});

// ── taxonomy ──────────────────────────────────────────────────────

test('flattenRegions expands an array of leaves into paths', () => {
  expect(flattenRegions({ 'Loire Valley': ['Sancerre', 'Vouvray'] })).toEqual([
    'Loire Valley', 'Loire Valley / Sancerre', 'Loire Valley / Vouvray',
  ]);
});

test('flattenRegions recurses through nested objects to any depth', () => {
  expect(flattenRegions({ Bourgogne: { 'Côte de Nuits': ['Vosne-Romanée'] } })).toEqual([
    'Bourgogne', 'Bourgogne / Côte de Nuits', 'Bourgogne / Côte de Nuits / Vosne-Romanée',
  ]);
});

test('flattenRegions treats an empty list as a leaf region', () => {
  expect(flattenRegions({ Alsace: [] })).toEqual(['Alsace']);
});

test('knownRegions returns real appellations for a listed country', () => {
  const france = knownRegions('France');
  expect(france).toContain('Loire Valley');
  expect(france).toContain('Loire Valley / Sancerre');
  expect(france).not.toContain('Toscana');
});

// This empty result is what stops the admin form flagging every whiskey region,
// and every country not yet transcribed into the taxonomy.
test('knownRegions returns [] for a country absent from the taxonomy', () => {
  expect(knownRegions('Scotland')).toEqual([]);
  expect(knownRegions(undefined)).toEqual([]);
});

test('the regions the migration nests are children in the taxonomy, not top-level', () => {
  const italy = knownRegions('Italy');
  expect(italy).toContain('Toscana / Chianti');
  expect(italy).toContain('Puglia / Salento');
  expect(italy).toContain('Veneto / Valpolicella');
  expect(italy).not.toContain('Chianti');
});

// Chianti Classico is its own DOCG, a sibling of Chianti rather than a subzone of it.
test('Chianti Classico sits beside Chianti, not beneath it', () => {
  const italy = knownRegions('Italy');
  expect(italy).toContain('Toscana / Chianti Classico');
  expect(italy).not.toContain('Toscana / Chianti / Chianti Classico');
});
