import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DrinkTable, { COLUMNS, resolveColumnOrder } from '../components/DrinkTable';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters, matchesFilters, applyUrlRangeOverrides, applyUrlDropdownOverrides, PRODUCER_FIELD, DROPDOWN_CONFIGS } from '../utils/filterHelpers';
import { buildWeightedRatings } from '../utils/analyticsHelpers';
import { useSearchResults } from '../hooks/useSearchResults';

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const FILTERS = ['all', ...CATEGORIES];
const STORAGE_KEY = 'drinks_columns_all';
const FILTERABLE_ALL = new Set([PRODUCER_FIELD.all, ...DROPDOWN_CONFIGS.all.filter(c => !c.varietyGroups).map(c => c.key)]);

const PRESETS = [
  { label: 'Top rated', key: 'weightedRating', dir: 'desc' },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilters, setActiveFilters] = useState(() =>
    applyUrlDropdownOverrides(applyUrlRangeOverrides(buildInitialFilters('all'), searchParams, 'all'), searchParams, 'all')
  );
  const [columnLayout, setColumnLayout] = useState(() => loadLayout());
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const searchQuery = (searchParams.get('q') || '').toLowerCase().trim();
  const navigate = useNavigate();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => {
    if (searchQuery) setActiveFilters(buildInitialFilters('all'));
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

  const categoryFiltered = useMemo(() => {
    const scoped = filter === 'all' ? drinks : drinks.filter(d => d._category.toLowerCase() === filter);
    const weights = buildWeightedRatings(scoped);
    return scoped.map(d => ({ ...d, weightedRating: weights.get(d.id) ?? null }));
  }, [drinks, filter]);

  const searchIds = useSearchResults(CATEGORIES, activeFilters.producerSearch);
  const searchScoped = searchIds == null ? categoryFiltered : categoryFiltered.filter(d => searchIds.has(d.id));
  const filterMatched = searchScoped.filter(d => matchesFilters(d, activeFilters, 'all'));
  const qIds = useSearchResults(CATEGORIES, searchQuery);
  const visible = qIds == null ? filterMatched : filterMatched.filter(d => qIds.has(d.id));

  const handleCellClick = (colKey, value) => {
    setActiveFilters(prev =>
      colKey === PRODUCER_FIELD.all
        ? { ...prev, producerSearch: value }
        : { ...prev, [colKey]: new Set([...prev[colKey], value]) }
    );
  };

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
        <button type="button" className="btn-outline" onClick={() => navigate('/admin', { state: filter === 'all' ? { tab: 'review' } : { category: filter, tab: 'review' } })}>
          Add Review
        </button>
        <button type="button" className="btn-outline" onClick={() => navigate('/admin', { state: filter === 'all' ? { tab: 'collection' } : { category: filter, tab: 'collection' } })}>
          Add to Collection
        </button>
      </div>
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

      <FilterBar
        category="all"
        drinks={categoryFiltered}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
      />

      {searchQuery && (
        <div className="filter-chips">
          <span className="filter-chip">
            Search: {searchQuery}
            <button onClick={() => setSearchParams({})} aria-label="Clear search">×</button>
          </span>
        </div>
      )}
      <DrinkTable
        category="all"
        drinks={visible}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
        filterableCols={FILTERABLE_ALL}
        onCellClick={handleCellClick}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
