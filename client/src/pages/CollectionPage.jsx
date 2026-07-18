import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable, { COLUMNS, resolveColumnOrder } from '../components/DrinkTable';
import FilterBar from '../components/FilterBar';
import AutocompleteInput from '../components/AutocompleteInput';
import { buildInitialFilters, matchesFilters, PRODUCER_FIELD, DROPDOWN_CONFIGS, buildDropdownOptions } from '../utils/filterHelpers';
import { useSearchResults } from '../hooks/useSearchResults';
import '../components/BulkEditBar.css';
import './CollectionPage.css';

const STORAGE_KEY = 'drinks_columns_collection';
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const FILTERS = ['all', ...CATEGORIES];
const FILTERABLE = new Set([PRODUCER_FIELD.all, ...DROPDOWN_CONFIGS.all.filter(c => !c.varietyGroups).map(c => c.key)]);
const TAGS_CONFIG = DROPDOWN_CONFIGS.all.find(c => c.key === 'tags');

function CollectionBulkEditBar({ drinks, selectedIds, onApplied, onCancel }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');

  const { options: suggestions } = buildDropdownOptions(drinks, TAGS_CONFIG);
  const count = selectedIds.size;
  const countLabel = `${count} ${count === 1 ? 'entry' : 'entries'}`;

  const apply = async (tagAction) => {
    const verb = tagAction === 'add' ? `Add tag "${value}" to` : `Remove tag "${value}" from`;
    if (!window.confirm(`${verb} ${countLabel}?`)) return;
    const selected = drinks.filter(d => selectedIds.has(d.id));
    const byCategory = new Map();
    for (const d of selected) {
      const cat = d._category.toLowerCase();
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(d.id);
    }
    const results = await Promise.all([...byCategory.entries()].map(async ([cat, ids]) => {
      const res = await fetch(`/api/${cat}/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, field: TAGS_CONFIG.key, value, tagAction }),
      });
      if (!res.ok) return null;
      const { updated } = await res.json();
      return updated.map(d => ({ ...d, _category: cat }));
    }));
    if (results.some(r => r === null)) { setMessage('Bulk edit failed. Please try again.'); return; }
    setValue('');
    setMessage('');
    onApplied(results.flat());
  };

  return (
    <div className="bulk-edit-bar" data-testid="collection-bulk-edit-bar">
      <span className="bulk-edit-count">{countLabel} selected</span>
      <AutocompleteInput
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Tag"
        className="bulk-edit-value-input"
        suggestions={suggestions}
        inputTestId="collection-bulk-edit-value"
      />
      <button type="button" className="bulk-edit-btn" disabled={!value} onClick={() => apply('add')}>Add to {count}</button>
      <button type="button" className="bulk-edit-btn bulk-edit-btn-danger" disabled={!value} onClick={() => apply('remove')}>Remove from {count}</button>
      <button type="button" className="bulk-edit-cancel" onClick={onCancel}>Cancel</button>
      {message && <span className="bulk-edit-message">{message}</span>}
    </div>
  );
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { order, hidden } = JSON.parse(raw);
    return { order: resolveColumnOrder(order, COLUMNS['collection']), hidden: new Set(hidden) };
  } catch { return null; }
}

function saveLayout(layout) {
  if (!layout) { localStorage.removeItem(STORAGE_KEY); return; }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: layout.order, hidden: [...layout.hidden] }));
}

function normalize(entry) {
  return {
    ...entry,
    _category: entry._category.charAt(0).toUpperCase() + entry._category.slice(1),
    _producer: entry.producer ?? entry.brewery ?? entry.distillery ?? '—',
    name: entry.seriesAndName || entry.name || '',
    photo: entry.collectionImageUrl,
    price: newestInStockLot(entry)?.price ?? null,
  };
}

function totalQty(drink) {
  return (drink.collection || []).reduce((sum, l) => sum + l.quantity, 0);
}

function newestInStockLot(drink) {
  return (drink.collection || [])
    .filter(l => l.quantity > 0)
    .sort((a, b) => (b.addedAt > a.addedAt ? 1 : -1))[0] ?? null;
}

function oldestInStockLot(drink) {
  return (drink.collection || [])
    .filter(l => l.quantity > 0)
    .sort((a, b) => (a.addedAt > b.addedAt ? 1 : -1))[0] ?? null;
}

function weightedPick(items, weightFn) {
  const total = items.reduce((sum, d) => sum + weightFn(d), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const item of items) {
    r -= weightFn(item);
    if (r < 0) return item;
  }
}

function fetchCollection(setDrinks) {
  fetch('/api/collection')
    .then(r => r.json())
    .then(data => setDrinks(data.map(normalize)))
    .catch(() => {});
}

export default function CollectionPage() {
  const [drinks, setDrinks] = useState([]);
  const [pick, setPick] = useState(null);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [activeFilters, setActiveFilters] = useState(() => buildInitialFilters('all'));
  const [columnLayout, setColumnLayout] = useState(() => loadLayout());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pendingStockIds, setPendingStockIds] = useState(new Set());

  useEffect(() => { fetchCollection(setDrinks); }, []);

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
    const byId = new Map(updated.map(d => [d.id, normalize(d)]));
    setDrinks(prev => prev.map(d => byId.get(d.id) ?? d));
    setSelectedIds(new Set());
  };

  const adjustStock = async (drink, lot, delta) => {
    if (!lot || pendingStockIds.has(drink.id)) return;
    setPendingStockIds(prev => new Set(prev).add(drink.id));
    try {
      await fetch(`/api/${drink._category.toLowerCase()}/${drink.id}/collection/${lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: lot.quantity + delta }),
      });
      fetchCollection(setDrinks);
    } finally {
      setPendingStockIds(prev => { const next = new Set(prev); next.delete(drink.id); return next; });
    }
  };

  const handleDecrement = (drink) => adjustStock(drink, oldestInStockLot(drink), -1);
  const handleIncrement = (drink) => adjustStock(drink, newestInStockLot(drink), 1);

  const handlePick = () => {
    const picked = weightedPick(visible, totalQty);
    if (!picked) {
      alert(`Nothing in stock${filter !== 'all' ? ` in ${filter}` : ''} to pick from.`);
      return;
    }
    setPick(picked);
  };

  const handleDrankIt = (drink) => {
    const lot = oldestInStockLot(drink);
    const tab = drink.tastingCount > 0 ? 'tastings' : 'review';
    navigate('/admin', { state: { drink, category: drink._category.toLowerCase(), drankIt: true, lot, tab } });
  };

  const handleEdit = (drink) => {
    navigate('/admin', { state: { category: drink._category.toLowerCase(), drink, tab: 'collection' } });
  };

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(next);
  };

  const categoryFiltered = filter === 'all' ? drinks : drinks.filter(d => d._category.toLowerCase() === filter);
  const searchIds = useSearchResults(CATEGORIES, activeFilters.producerSearch);
  const searchScoped = searchIds == null ? categoryFiltered : categoryFiltered.filter(d => searchIds.has(d.id));
  const visible = searchScoped.filter(d => matchesFilters(d, activeFilters, 'all'));

  const handleCellClick = (colKey, value) => {
    setActiveFilters(prev =>
      colKey === PRODUCER_FIELD.all
        ? { ...prev, producerSearch: value }
        : { ...prev, [colKey]: new Set([...prev[colKey], value]) }
    );
  };

  const renderRowExtra = (drink) => {
    const busy = pendingStockIds.has(drink.id);
    return (
      <div className="stock-controls">
        <button className="stock-btn" onClick={() => handleDecrement(drink)} disabled={busy} aria-label="Remove one bottle">−</button>
        <span className="stock-badge" data-testid="stock-badge">{totalQty(drink)}</span>
        <button className="stock-btn" onClick={() => handleIncrement(drink)} disabled={busy} aria-label="Add one bottle">+</button>
        <button className="drank-it-btn" onClick={() => handleDrankIt(drink)}>Drank it</button>
      </div>
    );
  };

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>My Collection</h1>
        <span className="count-badge">{visible.length} {visible.length === 1 ? 'drink' : 'drinks'}</span>
        <button className="sort-preset" onClick={handlePick}>Pick for me</button>
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

      {selectedIds.size > 0 && (
        <CollectionBulkEditBar
          drinks={categoryFiltered}
          selectedIds={selectedIds}
          onApplied={handleBulkApplied}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}

      {pick && (
        <div className="pick-spotlight" role="dialog" aria-label="Random pick">
          <div className="pick-card">
            <button className="pick-close" onClick={() => setPick(null)} aria-label="Close">×</button>
            <h2>{pick._producer}</h2>
            <p className="pick-name">{pick.name}</p>
            <p>{pick._category}{pick.country ? ` · ${pick.country}` : ''}</p>
            {pick.abv && <p>ABV: {pick.abv}%</p>}
            {pick.avgRating && <p>Rating: {pick.avgRating}</p>}
            <p>In stock: {totalQty(pick)}</p>
          </div>
        </div>
      )}

      <DrinkTable
        category="collection"
        drinks={visible}
        renderRowExtra={renderRowExtra}
        onEdit={handleEdit}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
        filterableCols={FILTERABLE}
        onCellClick={handleCellClick}
        selectedIds={selectedIds}
        onToggleRow={handleToggleRow}
        onToggleAll={handleToggleAll}
      />
    </div>
  );
}
