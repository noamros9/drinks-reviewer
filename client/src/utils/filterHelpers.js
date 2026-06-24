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
    { key: 'variety',      label: 'Variety',  varietyGroups: true, partialMatch: true },
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

export const isBlend = (variety) =>
  !!variety && (variety.includes('/') || variety.toLowerCase().includes('blend') || variety.includes(','));

function matchCountry(country, selected) {
  if (selected.has(country)) return true;
  if (selected.has('Old World') && OLD_WORLD.includes(country)) return true;
  if (selected.has('New World') && NEW_WORLD.includes(country)) return true;
  if (selected.has('Other') && !OLD_WORLD.includes(country) && !NEW_WORLD.includes(country)) return true;
  return false;
}

function matchVariety(variety, selected) {
  for (const v of selected) {
    if (v === 'Blend' && isBlend(variety)) return true;
    if (v === 'Single Variety' && !isBlend(variety)) return true;
    if (v !== 'Blend' && v !== 'Single Variety' && variety?.toLowerCase().includes(v.toLowerCase())) return true;
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
    } else if (conf.varietyGroups || conf.partialMatch) {
      if (!matchVariety(drink[conf.key], selected)) return false;
    } else {
      if (!selected.has(drink[conf.key])) return false;
    }
  }
  return true;
}

export function buildDropdownOptions(drinks, conf) {
  const raw = [...new Set(drinks.map(d => d[conf.key]).filter(Boolean))].sort();

  const special = [];
  if (conf.worldGroups) {
    const countries = new Set(drinks.map(d => d.country).filter(Boolean));
    if ([...countries].some(c => OLD_WORLD.includes(c))) special.push('Old World');
    if ([...countries].some(c => NEW_WORLD.includes(c))) special.push('New World');
    if ([...countries].some(c => !OLD_WORLD.includes(c) && !NEW_WORLD.includes(c))) special.push('Other');
  }
  if (conf.varietyGroups) {
    if (drinks.some(d => isBlend(d.variety)))    special.push('Blend');
    if (drinks.some(d => !isBlend(d.variety)))   special.push('Single Variety');
  }

  return { special, options: raw };
}

export function buildInitialFilters(category) {
  const filters = { producerSearch: '' };
  for (const conf of (DROPDOWN_CONFIGS[category] || [])) {
    filters[conf.key] = new Set();
  }
  return filters;
}
