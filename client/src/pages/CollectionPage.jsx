import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable, { COLUMNS, resolveColumnOrder } from '../components/DrinkTable';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters, matchesFilters, PRODUCER_FIELD, DROPDOWN_CONFIGS } from '../utils/filterHelpers';
import { useSearchResults } from '../hooks/useSearchResults';
import './CollectionPage.css';

const STORAGE_KEY = 'drinks_columns_collection';
const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];
const FILTERS = ['all', ...CATEGORIES];
const FILTERABLE = new Set([PRODUCER_FIELD.all, ...DROPDOWN_CONFIGS.all.filter(c => !c.varietyGroups).map(c => c.key)]);

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

  useEffect(() => { fetchCollection(setDrinks); }, []);

  const handleDecrement = async (drink) => {
    const lot = oldestInStockLot(drink);
    if (!lot) return;
    await fetch(`/api/${drink._category.toLowerCase()}/${drink.id}/collection/${lot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: lot.quantity - 1 }),
    });
    fetchCollection(setDrinks);
  };

  const handleIncrement = async (drink) => {
    const lot = newestInStockLot(drink);
    if (!lot) return;
    await fetch(`/api/${drink._category.toLowerCase()}/${drink.id}/collection/${lot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: lot.quantity + 1 }),
    });
    fetchCollection(setDrinks);
  };

  const handlePick = () => {
    if (!drinks.length) return;
    setPick(drinks[Math.floor(Math.random() * drinks.length)]);
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

  const renderRowExtra = (drink) => (
    <div className="stock-controls">
      <button className="stock-btn" onClick={() => handleDecrement(drink)} aria-label="Remove one bottle">−</button>
      <span className="stock-badge" data-testid="stock-badge">{totalQty(drink)}</span>
      <button className="stock-btn" onClick={() => handleIncrement(drink)} aria-label="Add one bottle">+</button>
      <button className="drank-it-btn" onClick={() => handleDrankIt(drink)}>Drank it</button>
    </div>
  );

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
      />
    </div>
  );
}
