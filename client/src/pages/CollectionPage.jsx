import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable from '../components/DrinkTable';
import './CollectionPage.css';

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
        <span className="count-badge">{drinks.length} {drinks.length === 1 ? 'drink' : 'drinks'}</span>
        <button className="sort-preset" onClick={handlePick}>Pick for me</button>
      </div>

      {pick && (
        <div className="pick-spotlight" role="dialog" aria-label="Random pick">
          <div className="pick-card">
            <button className="pick-close" onClick={() => setPick(null)} aria-label="Close">×</button>
            <h2>{pick._producer}</h2>
            <p className="pick-name">{pick.name}</p>
            <p>{pick._category}{pick.country ? ` · ${pick.country}` : ''}</p>
            {pick.abv && <p>ABV: {pick.abv}%</p>}
            {pick.avgRanking && <p>Rating: {pick.avgRanking}</p>}
            <p>In stock: {totalQty(pick)}</p>
          </div>
        </div>
      )}

      <DrinkTable
        category="collection"
        drinks={drinks}
        renderRowExtra={renderRowExtra}
      />
    </div>
  );
}
