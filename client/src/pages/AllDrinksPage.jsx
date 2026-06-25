import { useEffect, useState } from 'react';
import DrinkTable, { COLUMNS } from '../components/DrinkTable';
import ColumnPanel from '../components/ColumnPanel';
import FilterDropdown from '../components/FilterDropdown';
import { buildDropdownOptions, countOptions, matchesFilters } from '../utils/filterHelpers';

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
  return entries.map(entry => ({
    ...entry,
    _category: category.charAt(0).toUpperCase() + category.slice(1),
    _producer: entry.producer ?? entry.brewery ?? entry.distillery ?? '—',
    name: entry.seriesAndName ?? entry.name,
  }));
}

export default function AllDrinksPage() {
  const [drinks, setDrinks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState(new Set());
  const [columnLayout, setColumnLayout] = useState(() => loadLayout());

  useEffect(() => {
    Promise.all(
      ['wine', 'beer', 'whiskey', 'others'].map(cat =>
        fetch(`/api/${cat}`).then(r => r.json()).then(data => normalize(data, cat))
      )
    ).then(results => setDrinks(results.flat())).catch(() => {});
  }, []);

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(next);
  };

  const categoryFiltered = filter === 'all'
    ? drinks
    : drinks.filter(d => d._category.toLowerCase() === filter);

  const activeFilters = { producerSearch: '', country: countryFilter };
  const visible = countryFilter.size === 0
    ? categoryFiltered
    : categoryFiltered.filter(d => matchesFilters(d, activeFilters, 'all'));

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
        <FilterDropdown
          label="Country"
          options={countryOptions}
          specialOptions={[]}
          selected={countryFilter}
          counts={countryCounts}
          onChange={setCountryFilter}
        />
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
      />
    </div>
  );
}
