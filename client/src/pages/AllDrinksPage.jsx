import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DrinkTable, { COLUMNS, resolveColumnOrder } from '../components/DrinkTable';
import ColumnPanel from '../components/ColumnPanel';
import FilterDropdown from '../components/FilterDropdown';
import RangeFilter from '../components/RangeFilter';
import RangeFilterChips from '../components/RangeFilterChips';
import { buildDropdownOptions, countOptions, matchesFilters, buildEmptyRangeFilters, RANGE_FILTER_CONFIGS, applyUrlRangeOverrides } from '../utils/filterHelpers';
import './AllDrinksPage.css';

const FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const STORAGE_KEY = 'drinks_columns_all';
const FILTERABLE_ALL = new Set(['country', '_producer']);
const RANGE_CONFIGS = RANGE_FILTER_CONFIGS.all;

const PRESETS = [
  { label: 'Top rated', key: 'avgRating', dir: 'desc' },
  { label: 'Recently tasted', key: 'lastTasted', dir: 'desc' },
];

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { order, hidden } = JSON.parse(raw);
    return { order: resolveColumnOrder(order, COLUMNS['all']), hidden: new Set(hidden) };
  } catch { return null; }
}

function saveLayout(layout) {
  if (!layout) { localStorage.removeItem(STORAGE_KEY); return; }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: layout.order, hidden: [...layout.hidden] }));
}

function normalize(entries, category) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => ({
    ...entry,
    _category: category.charAt(0).toUpperCase() + category.slice(1),
    _producer: entry.producer ?? entry.brewery ?? entry.distillery ?? '—',
    name: entry.seriesAndName || entry.name || '',
  }));
}

export default function AllDrinksPage() {
  const [drinks, setDrinks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const [rangeFilters, setRangeFilters] = useState(() => applyUrlRangeOverrides(buildEmptyRangeFilters('all'), searchParams, 'all'));
  const [producerSearch, setProducerSearch] = useState('');
  const [columnLayout, setColumnLayout] = useState(() => loadLayout());
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const searchQuery = (searchParams.get('q') || '').toLowerCase().trim();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => {
    if (searchQuery) {
      setCountryFilter(new Set());
      setProducerSearch('');
      setRangeFilters(buildEmptyRangeFilters('all'));
    }
  }, [searchQuery]);

  useEffect(() => {
    Promise.all(
      ['wine', 'beer', 'whiskey', 'others'].map(cat =>
        fetch(`/api/${cat}`)
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(data => normalize(data, cat))
          .catch(() => [])
      )
    ).then(results => setDrinks(results.flat()));
  }, []);

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(next);
  };

  const categoryFiltered = filter === 'all'
    ? drinks
    : drinks.filter(d => d._category.toLowerCase() === filter);

  const activeFilters = { producerSearch, country: countryFilter, ...rangeFilters };
  const hasRangeFilter = Object.values(rangeFilters).some(v => v !== '');
  const hasFilter = countryFilter.size > 0 || hasRangeFilter || producerSearch !== '';
  const filterMatched = hasFilter
    ? categoryFiltered.filter(d => matchesFilters(d, activeFilters, 'all'))
    : categoryFiltered;
  const visible = searchQuery
    ? filterMatched.filter(d => Object.values(d).some(v => v != null && String(v).toLowerCase().includes(searchQuery)))
    : filterMatched;

  const { options: countryOptions } = buildDropdownOptions(categoryFiltered, { key: 'country' });
  const countryCounts = countOptions(categoryFiltered, { key: 'country' }, activeFilters, 'all');

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>All Drinks</h1>
        <span className="count-badge">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}</span>
        <div className="sort-presets">
          {PRESETS.map(p => (
            <button
              key={p.label}
              className={`sort-preset${sortKey === p.key && sortDir === p.dir ? ' active' : ''}`}
              onClick={() => { setSortKey(p.key); setSortDir(p.dir); }}
            >{p.label}</button>
          ))}
        </div>
      </div>
      <div className="all-page-toolbar">
        <div className="category-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="toolbar-divider">|</span>
        <FilterDropdown
          label="Country"
          options={countryOptions}
          specialOptions={[]}
          selected={countryFilter}
          counts={countryCounts}
          onChange={setCountryFilter}
        />
        {RANGE_CONFIGS.map(conf => (
          <RangeFilter
            key={conf.key}
            config={conf}
            min={rangeFilters[`${conf.key}Min`]}
            max={rangeFilters[`${conf.key}Max`]}
            onChange={(min, max) => setRangeFilters(prev => ({ ...prev, [`${conf.key}Min`]: min, [`${conf.key}Max`]: max }))}
          />
        ))}
        <div className="filter-bar-spacer" />
        <ColumnPanel
          allColumns={COLUMNS['all']}
          columnLayout={columnLayout}
          onChange={handleColumnLayoutChange}
        />
      </div>
      {(countryFilter.size > 0 || hasRangeFilter || producerSearch || searchQuery) && (
        <div className="filter-chips">
          {searchQuery && (
            <span className="filter-chip">
              Search: {searchQuery}
              <button onClick={() => setSearchParams({})} aria-label="Clear search">×</button>
            </span>
          )}
          {[...countryFilter].map(c => (
            <span key={c} className="filter-chip">
              {c}
              <button onClick={() => setCountryFilter(prev => { const next = new Set(prev); next.delete(c); return next; })} aria-label={`Remove ${c} filter`}>×</button>
            </span>
          ))}
          {producerSearch && (
            <span className="filter-chip">
              Producer: {producerSearch}
              <button onClick={() => setProducerSearch('')} aria-label="Remove producer filter">×</button>
            </span>
          )}
          <RangeFilterChips
            configs={RANGE_CONFIGS}
            values={rangeFilters}
            onClear={key => setRangeFilters(prev => ({ ...prev, [`${key}Min`]: '', [`${key}Max`]: '' }))}
          />
        </div>
      )}
      <DrinkTable
        category="all"
        drinks={visible}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
        filterableCols={FILTERABLE_ALL}
        onCellClick={(colKey, value) => {
          if (colKey === 'country') setCountryFilter(prev => new Set([...prev, value]));
          if (colKey === '_producer') setProducerSearch(value);
        }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
