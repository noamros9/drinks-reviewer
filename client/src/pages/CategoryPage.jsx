import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DrinkTable, { COLUMNS, resolveColumnOrder } from '../components/DrinkTable';
import FilterBar from '../components/FilterBar';
import BulkEditBar from '../components/BulkEditBar';
import CompareBar from '../components/CompareBar';
import RecommendBar from '../components/RecommendBar';
import { buildInitialFilters, matchesFilters, PRODUCER_FIELD, DROPDOWN_CONFIGS, applyUrlRangeOverrides, applyUrlDropdownOverrides, applyUrlProducerOverride } from '../utils/filterHelpers';
import { buildWeightedRatings } from '../utils/analyticsHelpers';

const TITLES = { wine: 'Wine', beer: 'Beer', whiskey: 'Whiskey', others: 'Others' };

const PRESETS = [
  { label: 'Top rated', key: 'weightedRating', dir: 'desc' },
  { label: 'Recently tasted', key: 'lastTasted', dir: 'desc' },
];

function storageKey(category) { return `drinks_columns_v3_${category}`; }

function loadLayout(category) {
  try {
    const raw = localStorage.getItem(storageKey(category));
    if (!raw) return null;
    const { order, hidden } = JSON.parse(raw);
    return { order: resolveColumnOrder(order, COLUMNS[category] || []), hidden: new Set(hidden) };
  } catch { return null; }
}

function saveLayout(category, layout) {
  if (!layout) { localStorage.removeItem(storageKey(category)); return; }
  localStorage.setItem(storageKey(category), JSON.stringify({ order: layout.order, hidden: [...layout.hidden] }));
}

export default function CategoryPage({ category }) {
  const [drinks, setDrinks] = useState([]);
  const [searchParams] = useSearchParams();
  const [activeFilters, setActiveFilters] = useState(() => applyUrlProducerOverride(applyUrlDropdownOverrides(applyUrlRangeOverrides(buildInitialFilters(category), searchParams, category), searchParams, category), searchParams));
  const [columnLayout, setColumnLayout] = useState(() => loadLayout(category));
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => {
    setActiveFilters(applyUrlProducerOverride(applyUrlDropdownOverrides(applyUrlRangeOverrides(buildInitialFilters(category), searchParams, category), searchParams, category), searchParams));
    setColumnLayout(loadLayout(category));
    setSelectedIds(new Set());
    fetch(`/api/${category}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { if (Array.isArray(data)) setDrinks(data); })
      .catch(() => {});
  }, [category]);

  const handleToggleRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleAll = (ids, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const handleBulkApplied = (updated) => {
    const byId = new Map(updated.map(d => [d.id, d]));
    setDrinks(prev => prev.map(d => byId.get(d.id) ?? d));
    setSelectedIds(new Set());
  };

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(category, next);
  };

  const drinksWithScore = useMemo(() => {
    const weights = buildWeightedRatings(drinks);
    return drinks.map(d => ({ ...d, weightedRating: weights.get(d.id) ?? null }));
  }, [drinks]);

  const filtered = drinksWithScore.filter(d => matchesFilters(d, activeFilters, category));

  const filterableCols = useMemo(() => new Set([
    PRODUCER_FIELD[category],
    ...DROPDOWN_CONFIGS[category].filter(c => !c.varietyGroups).map(c => c.key),
  ]), [category]);

  const handleCellClick = (colKey, value) => {
    const producerCol = PRODUCER_FIELD[category];
    setActiveFilters(prev =>
      colKey === producerCol
        ? { ...prev, producerSearch: value }
        : { ...prev, [colKey]: new Set([...prev[colKey], value]) }
    );
  };

  const handleEdit = (drink) => {
    navigate('/admin', { state: { category, drink } });
  };

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>{TITLES[category]}</h1>
        <span className="count-badge">
          {filtered.length}{filtered.length !== drinks.length ? ` / ${drinks.length}` : ''}{' '}
          {drinks.length === 1 ? 'entry' : 'entries'}
        </span>
        <div className="sort-presets">
          {PRESETS.map(p => (
            <button
              key={p.label}
              className={`sort-preset${sortKey === p.key && sortDir === p.dir ? ' active' : ''}`}
              onClick={() => { setSortKey(p.key); setSortDir(p.dir); }}
            >{p.label}</button>
          ))}
        </div>
        <button type="button" className="btn-outline" onClick={() => navigate(`/taste-card?category=${category}`)}>
          Generate taste card
        </button>
      </div>
      <FilterBar
        category={category}
        drinks={drinks}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
      />
      {selectedIds.size > 0 && (
        <BulkEditBar
          category={category}
          drinks={filtered}
          selectedIds={selectedIds}
          onApplied={handleBulkApplied}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}
      {selectedIds.size >= 2 && selectedIds.size <= 5 && (
        <CompareBar
          category={category}
          selectedIds={selectedIds}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}
      {selectedIds.size >= 1 && selectedIds.size <= 5 && (
        <RecommendBar
          category={category}
          selectedIds={selectedIds}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}
      <DrinkTable
        category={category}
        drinks={filtered}
        onEdit={handleEdit}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
        filterableCols={filterableCols}
        onCellClick={handleCellClick}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        activeVintage={activeFilters.vintage?.size === 1 ? [...activeFilters.vintage][0] : null}
        selectedIds={selectedIds}
        onToggleRow={handleToggleRow}
        onToggleAll={handleToggleAll}
      />
    </div>
  );
}
