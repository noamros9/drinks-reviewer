import { useEffect, useState } from 'react';
import DrinkTable, { COLUMNS } from '../components/DrinkTable';
import ColumnPanel from '../components/ColumnPanel';
import FilterDropdown from '../components/FilterDropdown';
import AbvFilter from '../components/AbvFilter';
import { buildDropdownOptions, countOptions, matchesFilters } from '../utils/filterHelpers';
import './AllDrinksPage.css';

const FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const STORAGE_KEY = 'drinks_columns_all';

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { order, hidden } = JSON.parse(raw);
    return { order, hidden: new Set(hidden) };
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
  const [abvMin, setAbvMin] = useState('');
  const [abvMax, setAbvMax] = useState('');
  const [columnLayout, setColumnLayout] = useState(() => loadLayout());

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

  const activeFilters = { producerSearch: '', country: countryFilter, abvMin, abvMax };
  const hasFilter = countryFilter.size > 0 || abvMin !== '' || abvMax !== '';
  const visible = hasFilter
    ? categoryFiltered.filter(d => matchesFilters(d, activeFilters, 'all'))
    : categoryFiltered;

  const { options: countryOptions } = buildDropdownOptions(categoryFiltered, { key: 'country' });
  const countryCounts = countOptions(categoryFiltered, { key: 'country' }, activeFilters, 'all');

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>All Drinks</h1>
        <span className="count-badge">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}</span>
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
        <AbvFilter
          abvMin={abvMin}
          abvMax={abvMax}
          onChange={({ abvMin: mn, abvMax: mx }) => { setAbvMin(mn); setAbvMax(mx); }}
        />
        <div className="filter-bar-spacer" />
        <ColumnPanel
          allColumns={COLUMNS['all']}
          columnLayout={columnLayout}
          onChange={handleColumnLayoutChange}
        />
      </div>
      <DrinkTable
        category="all"
        drinks={visible}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
        filterableCols={new Set(['country'])}
        onCellClick={(colKey, value) => {
          if (colKey === 'country') setCountryFilter(prev => new Set([...prev, value]));
        }}
      />
    </div>
  );
}
