import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable, { COLUMNS } from '../components/DrinkTable';
import ColumnPanel from '../components/ColumnPanel';
import FilterDropdown from '../components/FilterDropdown';
import AbvFilter from '../components/AbvFilter';
import { buildDropdownOptions, countOptions, matchesFilters } from '../utils/filterHelpers';
import './CollectionPage.css';

const STORAGE_KEY = 'drinks_columns_collection';
const FILTERABLE = new Set(['country', '_producer']);

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

function normalize(entry) {
  return {
    ...entry,
    _category: entry._category.charAt(0).toUpperCase() + entry._category.slice(1),
    _producer: entry.producer ?? entry.brewery ?? entry.distillery ?? '—',
    name: entry.seriesAndName || entry.name || '',
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
  const [countryFilter, setCountryFilter] = useState(new Set());
  const [abvMin, setAbvMin] = useState('');
  const [abvMax, setAbvMax] = useState('');
  const [producerSearch, setProducerSearch] = useState('');
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
    navigate('/admin', { state: { drink, category: drink._category.toLowerCase(), drankIt: true, lot } });
  };

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(next);
  };

  const activeFilters = { producerSearch, country: countryFilter, abvMin, abvMax };
  const hasFilter = countryFilter.size > 0 || abvMin !== '' || abvMax !== '' || producerSearch !== '';
  const visible = hasFilter ? drinks.filter(d => matchesFilters(d, activeFilters, 'all')) : drinks;

  const { options: countryOptions } = buildDropdownOptions(drinks, { key: 'country' });
  const countryCounts = countOptions(drinks, { key: 'country' }, activeFilters, 'all');

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
      </div>

      <div className="all-page-toolbar">
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
          allColumns={COLUMNS['collection']}
          columnLayout={columnLayout}
          onChange={handleColumnLayoutChange}
        />
      </div>

      {hasFilter && (
        <div className="filter-chips">
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
          {(abvMin !== '' || abvMax !== '') && (
            <span className="filter-chip">
              ABV: {abvMin !== '' ? abvMin : '0'}–{abvMax !== '' ? abvMax : '∞'}
              <button onClick={() => { setAbvMin(''); setAbvMax(''); }} aria-label="Remove ABV filter">×</button>
            </span>
          )}
        </div>
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
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
        filterableCols={FILTERABLE}
        onCellClick={(colKey, value) => {
          if (colKey === 'country') setCountryFilter(prev => new Set([...prev, value]));
          if (colKey === '_producer') setProducerSearch(value);
        }}
      />
    </div>
  );
}
