export const OLD_WORLD = [
  'France', 'Italy', 'Spain', 'Portugal', 'Germany', 'Austria', 'Greece',
  'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Georgia', 'Armenia',
  'Lebanon', 'Israel', 'Morocco', 'Turkey', 'Serbia', 'North Macedonia', 'Moldova',
  'Montenegro', 'Switzerland', 'England', 'Wales', 'Czech Republic', 'Slovakia',
  'Luxembourg', 'Cyprus', 'Malta',
];

export const NEW_WORLD = [
  'USA', 'United States', 'Australia', 'New Zealand', 'Chile', 'Argentina',
  'South Africa', 'Canada', 'Japan', 'China', 'Brazil', 'Uruguay', 'Mexico',
  'India', 'Peru', 'Zimbabwe',
];

export const PRODUCER_FIELD = {
  wine:    'producer',
  beer:    'brewery',
  whiskey: 'distillery',
  others:  'distillery',
};

export const DROPDOWN_CONFIGS = {
  wine: [
    { key: 'wineCategory', label: 'Type' },
    { key: 'country',      label: 'Country',  worldGroups: true },
    { key: 'variety',      label: 'Variety',  varietyGroups: true },
    { key: 'region',       label: 'Region' },
  ],
  beer: [
    { key: 'style',   label: 'Style' },
    { key: 'country', label: 'Country', worldGroups: true },
  ],
  whiskey: [
    { key: 'style',   label: 'Style' },
    { key: 'country', label: 'Country', worldGroups: true },
  ],
  others: [
    { key: 'drinkCategory', label: 'Category' },
    { key: 'style',         label: 'Style' },
    { key: 'country',       label: 'Country', worldGroups: true },
  ],
};

export function splitVarieties(variety) {
  if (!variety) return [];
  return variety
    .split(/\s*[/,]\s*|\s+and\s+|\s+&\s+/i)
    .map(v => v.trim())
    .filter(Boolean);
}

export const isBlend = (variety) => splitVarieties(variety).length > 1;

function matchCountry(country, selected) {
  if (selected.has(country)) return true;
  if (selected.has('Old World') && OLD_WORLD.includes(country)) return true;
  if (selected.has('New World') && NEW_WORLD.includes(country)) return true;
  if (selected.has('Other') && !OLD_WORLD.includes(country) && !NEW_WORLD.includes(country)) return true;
  return false;
}

function matchVariety(variety, selected) {
  const grapes = splitVarieties(variety);
  for (const v of selected) {
    if (v === 'Blend' && grapes.length > 1) return true;
    if (v === 'Single Variety' && grapes.length === 1) return true;
    if (v !== 'Blend' && v !== 'Single Variety' && grapes.includes(v)) return true;
  }
  return false;
}

export function matchesFilters(drink, activeFilters, category) {
  const producerField = PRODUCER_FIELD[category];
  if (activeFilters.producerSearch) {
    const val = drink[producerField] ?? '';
    if (!val.toLowerCase().includes(activeFilters.producerSearch.toLowerCase())) return false;
  }

  for (const conf of (DROPDOWN_CONFIGS[category] || [])) {
    const selected = activeFilters[conf.key];
    if (!selected || selected.size === 0) continue;

    if (conf.key === 'country') {
      if (!matchCountry(drink.country, selected)) return false;
    } else if (conf.varietyGroups) {
      if (!matchVariety(drink[conf.key], selected)) return false;
    } else {
      if (!selected.has(drink[conf.key])) return false;
    }
  }
  return true;
}

export function buildDropdownOptions(drinks, conf) {
  const special = [];

  if (conf.worldGroups) {
    const countries = new Set(drinks.map(d => d.country).filter(Boolean));
    if ([...countries].some(c => OLD_WORLD.includes(c))) special.push('Old World');
    if ([...countries].some(c => NEW_WORLD.includes(c))) special.push('New World');
    if ([...countries].some(c => !OLD_WORLD.includes(c) && !NEW_WORLD.includes(c))) special.push('Other');
  }

  if (conf.varietyGroups) {
    if (drinks.some(d => isBlend(d[conf.key])))  special.push('Blend');
    if (drinks.some(d => !isBlend(d[conf.key]))) special.push('Single Variety');
    const allGrapes = new Set();
    drinks.forEach(d => splitVarieties(d[conf.key]).forEach(g => allGrapes.add(g)));
    return { special, options: [...allGrapes].sort() };
  }

  const raw = [...new Set(drinks.map(d => d[conf.key]).filter(Boolean))].sort();
  return { special, options: raw };
}

export function buildInitialFilters(category) {
  const filters = { producerSearch: '' };
  for (const conf of (DROPDOWN_CONFIGS[category] || [])) {
    filters[conf.key] = new Set();
  }
  return filters;
}
