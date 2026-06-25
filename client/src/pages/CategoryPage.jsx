import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable from '../components/DrinkTable';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters, matchesFilters } from '../utils/filterHelpers';

const TITLES = { wine: 'Wine', beer: 'Beer', whiskey: 'Whiskey', others: 'Others' };

function storageKey(category) { return `drinks_columns_${category}`; }

function loadLayout(category) {
  try {
    const raw = localStorage.getItem(storageKey(category));
    if (!raw) return null;
    const { order, hidden } = JSON.parse(raw);
    return { order, hidden: new Set(hidden) };
  } catch { return null; }
}

function saveLayout(category, layout) {
  if (!layout) { localStorage.removeItem(storageKey(category)); return; }
  localStorage.setItem(storageKey(category), JSON.stringify({ order: layout.order, hidden: [...layout.hidden] }));
}

export default function CategoryPage({ category }) {
  const [drinks, setDrinks] = useState([]);
  const [activeFilters, setActiveFilters] = useState(() => buildInitialFilters(category));
  const [columnLayout, setColumnLayout] = useState(() => loadLayout(category));
  const navigate = useNavigate();

  useEffect(() => {
    setActiveFilters(buildInitialFilters(category));
    setColumnLayout(loadLayout(category));
    fetch(`/api/${category}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { if (Array.isArray(data)) setDrinks(data); })
      .catch(() => {});
  }, [category]);

  const handleColumnLayoutChange = (next) => {
    setColumnLayout(next);
    saveLayout(category, next);
  };

  const filtered = drinks.filter(d => matchesFilters(d, activeFilters, category));

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
      </div>
      <FilterBar
        category={category}
        drinks={drinks}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
      />
      <DrinkTable
        category={category}
        drinks={filtered}
        onEdit={handleEdit}
        columnLayout={columnLayout}
        onColumnLayoutChange={handleColumnLayoutChange}
      />
    </div>
  );
}
