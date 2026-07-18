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
  all:     '_producer',
};

export const NAME_FIELD = {
  wine:    'seriesAndName',
  beer:    'name',
  whiskey: 'name',
  others:  'name',
};

export function findDuplicate(drinks, category, producerVal, nameVal, excludeId) {
  const p = (producerVal || '').trim().toLowerCase();
  const n = (nameVal || '').trim().toLowerCase();
  if (!p || !n) return null;
  const producerKey = PRODUCER_FIELD[category];
  const nameKey = NAME_FIELD[category];
  return drinks.find(d =>
    d.id !== excludeId &&
    (d[producerKey] || '').trim().toLowerCase() === p &&
    (d[nameKey] || '').trim().toLowerCase() === n
  ) || null;
}

const ABV_RANGE = { key: 'abv', label: 'ABV', unit: '%', min: 0, max: 100, step: 0.1, unbounded: true };
const AVG_RATING_RANGE = { key: 'avgRating', label: 'Avg Rating', unit: '', min: 1, max: 10, step: 0.5 };
const VIVINO_RANGE = { key: 'vivinoScore', label: 'Vivino', unit: '', min: 1, max: 5, step: 0.1 };

export const RANGE_FILTER_CONFIGS = {
  wine:    [ABV_RANGE, AVG_RATING_RANGE, VIVINO_RANGE],
  beer:    [ABV_RANGE, AVG_RATING_RANGE],
  whiskey: [ABV_RANGE, AVG_RATING_RANGE],
  others:  [ABV_RANGE, AVG_RATING_RANGE],
  all:     [ABV_RANGE, AVG_RATING_RANGE],
};

export const DROPDOWN_CONFIGS = {
  wine: [
    { key: 'wineCategory', label: 'Type' },
    { key: 'sweetness',    label: 'Sweetness' },
    { key: 'country',      label: 'Country',  worldGroups: true },
    { key: 'variety',      label: 'Variety',  varietyGroups: true },
    { key: 'region',       label: 'Region' },
    { key: 'tags',         label: 'Tags',     multiValue: true },
    { key: 'vintage',      label: 'Vintage',  vintageFromTastings: true },
  ],
  beer: [
    { key: 'style',   label: 'Style' },
    { key: 'country', label: 'Country' },
    { key: 'tags',    label: 'Tags',    multiValue: true },
  ],
  whiskey: [
    { key: 'style',   label: 'Style' },
    { key: 'country', label: 'Country' },
    { key: 'region',  label: 'Region' },
    { key: 'tags',    label: 'Tags',    multiValue: true },
  ],
  others: [
    { key: 'drinkCategory', label: 'Category' },
    { key: 'style',         label: 'Style' },
    { key: 'country',       label: 'Country' },
    { key: 'tags',          label: 'Tags',    multiValue: true },
  ],
  all: [
    { key: 'country', label: 'Country' },
    { key: 'tags',    label: 'Tags',    multiValue: true },
  ],
};

export const isBlend = (varietyArr) => (varietyArr?.length ?? 0) > 1;

function matchCountry(country, selected) {
  if (selected.has(country)) return true;
  if (selected.has('Old World') && OLD_WORLD.includes(country)) return true;
  if (selected.has('New World') && NEW_WORLD.includes(country)) return true;
  if (selected.has('Other') && !OLD_WORLD.includes(country) && !NEW_WORLD.includes(country)) return true;
  return false;
}

function matchVariety(variety, selected) {
  const grapes = variety || [];
  for (const v of selected) {
    if (v === 'Blend' && grapes.length > 1) return true;
    if (v === 'Single Variety' && grapes.length === 1) return true;
    if (v !== 'Blend' && v !== 'Single Variety' && grapes.includes(v)) return true;
  }
  return false;
}

export function matchesFilters(drink, activeFilters, category) {
  for (const conf of (RANGE_FILTER_CONFIGS[category] || [])) {
    const rangeMin = activeFilters[`${conf.key}Min`] ?? '';
    const rangeMax = activeFilters[`${conf.key}Max`] ?? '';
    if (rangeMin === '' && rangeMax === '') continue;
    const val = parseFloat(drink[conf.key]);
    if (isNaN(val)) return false;
    if (rangeMin !== '' && val < parseFloat(rangeMin)) return false;
    if (rangeMax !== '' && val > parseFloat(rangeMax)) return false;
  }

  for (const conf of (DROPDOWN_CONFIGS[category] || [])) {
    const selected = activeFilters[conf.key];
    if (!selected || selected.size === 0) continue;

    if (conf.key === 'country') {
      if (!matchCountry(drink.country, selected)) return false;
    } else if (conf.varietyGroups) {
      if (!matchVariety(drink[conf.key], selected)) return false;
    } else if (conf.vintageFromTastings) {
      const tastingVintages = new Set((drink.tastings || []).map(t => t.vintage).filter(Boolean));
      if (![...selected].some(v => tastingVintages.has(v))) return false;
    } else if (conf.multiValue) {
      if (![...selected].some(t => (drink[conf.key] || []).includes(t))) return false;
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
    drinks.forEach(d => (d[conf.key] || []).forEach(g => allGrapes.add(g)));
    return { special, options: [...allGrapes].sort() };
  }

  if (conf.vintageFromTastings) {
    const all = new Set();
    drinks.forEach(d => (d.tastings || []).forEach(t => { if (t.vintage) all.add(t.vintage); }));
    return { special, options: [...all].sort() };
  }

  if (conf.multiValue) {
    const allTags = new Set();
    drinks.forEach(d => (d[conf.key] || []).forEach(t => allTags.add(t.trim().toLowerCase())));
    return { special, options: [...allTags].sort() };
  }

  const raw = [...new Set(drinks.map(d => d[conf.key]).filter(Boolean))].sort();
  return { special, options: raw };
}

export function countOptions(drinks, conf, activeFilters, category) {
  const otherFilters = { ...activeFilters, [conf.key]: new Set() };
  const filtered = drinks.filter(d => matchesFilters(d, otherFilters, category));
  const counts = {};
  filtered.forEach(d => {
    const raw = d[conf.key];
    if (conf.vintageFromTastings) {
      new Set((d.tastings || []).map(t => t.vintage).filter(Boolean)).forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
      });
    } else if (conf.multiValue) {
      (d[conf.key] || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    } else if (conf.varietyGroups) {
      (raw || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; });
      if (raw?.length) {
        if (isBlend(raw)) counts['Blend'] = (counts['Blend'] || 0) + 1;
        else counts['Single Variety'] = (counts['Single Variety'] || 0) + 1;
      }
    } else if (conf.worldGroups) {
      if (raw) {
        counts[raw] = (counts[raw] || 0) + 1;
        if (OLD_WORLD.includes(raw))      counts['Old World'] = (counts['Old World'] || 0) + 1;
        else if (NEW_WORLD.includes(raw)) counts['New World'] = (counts['New World'] || 0) + 1;
        else                              counts['Other']     = (counts['Other']     || 0) + 1;
      }
    } else {
      if (raw) counts[raw] = (counts[raw] || 0) + 1;
    }
  });
  return counts;
}

export function buildEmptyRangeFilters(category) {
  return Object.fromEntries((RANGE_FILTER_CONFIGS[category] || []).flatMap(c => [[`${c.key}Min`, ''], [`${c.key}Max`, '']]));
}

export function buildInitialFilters(category) {
  const filters = { producerSearch: '', ...buildEmptyRangeFilters(category) };
  for (const conf of (DROPDOWN_CONFIGS[category] || [])) {
    filters[conf.key] = new Set();
  }
  return filters;
}

export function applyUrlRangeOverrides(filters, searchParams, category) {
  const result = { ...filters };
  for (const conf of (RANGE_FILTER_CONFIGS[category] || [])) {
    const min = searchParams.get(`${conf.key}Min`);
    const max = searchParams.get(`${conf.key}Max`);
    if (min != null) result[`${conf.key}Min`] = min;
    if (max != null) result[`${conf.key}Max`] = max;
  }
  return result;
}

export function applyUrlDropdownOverrides(filters, searchParams, category) {
  const result = { ...filters };
  for (const conf of (DROPDOWN_CONFIGS[category] || [])) {
    const value = searchParams.get(conf.key);
    if (value != null) result[conf.key] = new Set([...(result[conf.key] ?? []), value]);
  }
  return result;
}

// Sets a plain string filter (producerSearch), unlike the dropdown filters above
// in this module which use Set-based multi-select shapes.
export function applyUrlProducerOverride(filters, searchParams) {
  const value = searchParams.get('producer');
  return value != null ? { ...filters, producerSearch: value } : filters;
}
