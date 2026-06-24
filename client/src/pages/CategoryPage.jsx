import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable from '../components/DrinkTable';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters, matchesFilters } from '../utils/filterHelpers';

const TITLES = {
  wine:    'Wine',
  beer:    'Beer',
  whiskey: 'Whiskey',
  others:  'Others',
};

export default function CategoryPage({ category }) {
  const [drinks, setDrinks] = useState([]);
  const [activeFilters, setActiveFilters] = useState(() => buildInitialFilters(category));
  const navigate = useNavigate();

  useEffect(() => {
    setActiveFilters(buildInitialFilters(category));
    fetch(`/api/${category}`)
      .then(r => r.json())
      .then(setDrinks)
      .catch(() => {});
  }, [category]);

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
      />
      <DrinkTable category={category} drinks={filtered} onEdit={handleEdit} />
    </div>
  );
}
