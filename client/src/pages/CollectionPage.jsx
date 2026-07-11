import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable, { COLUMNS, resolveColumnOrder } from '../components/DrinkTable';
import ColumnPanel from '../components/ColumnPanel';
import FilterDropdown from '../components/FilterDropdown';
import RangeFilter from '../components/RangeFilter';
import RangeFilterChips from '../components/RangeFilterChips';
import { buildDropdownOptions, countOptions, matchesFilters, buildEmptyRangeFilters, RANGE_FILTER_CONFIGS } from '../utils/filterHelpers';
import './CollectionPage.css';

const STORAGE_KEY = 'drinks_columns_collection';
const FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const FILTERABLE = new Set(['country', '_producer']);
const RANGE_CONFIGS = RANGE_FILTER_CONFIGS.all;

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
  const [countryFilter, setCountryFilter] = useState(new Set());
  const [rangeFilters, setRangeFilters] = useState(() => buildEmptyRangeFilters('all'));
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

  const handleEdit = (drink) => {
    navigate('/admin', { state: { category: drink._category.toLowerCase(), drink } });
  };

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(next);
  };

  const categoryFiltered = filter === 'all' ? drinks : drinks.filter(d => d._category.toLowerCase() === filter);
  const activeFilters = { producerSearch, country: countryFilter, ...rangeFilters };
  const hasRangeFilter = Object.values(rangeFilters).some(v => v !== '');
  const hasFilter = countryFilter.size > 0 || hasRangeFilter || producerSearch !== '';
  const visible = hasFilter ? categoryFiltered.filter(d => matchesFilters(d, activeFilters, 'all')) : categoryFiltered;

  const { options: countryOptions } = buildDropdownOptions(categoryFiltered, { key: 'country' });
  const countryCounts = countOptions(categoryFiltered, { key: 'country' }, activeFilters, 'all');

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
          <RangeFilterChips
            configs={RANGE_CONFIGS}
            values={rangeFilters}
            onClear={key => setRangeFilters(prev => ({ ...prev, [`${key}Min`]: '', [`${key}Max`]: '' }))}
          />
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
        onEdit={handleEdit}
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
