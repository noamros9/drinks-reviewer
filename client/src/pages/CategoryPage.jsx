import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkTable from '../components/DrinkTable';

const TITLES = {
  wine:    'Wine',
  beer:    'Beer',
  whiskey: 'Whiskey',
  others:  'Others',
};

export default function CategoryPage({ category }) {
  const [drinks, setDrinks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/${category}`)
      .then(r => r.json())
      .then(setDrinks)
      .catch(() => {});
  }, [category]);

  const handleEdit = (drink) => {
    navigate('/admin', { state: { category, drink } });
  };

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>{TITLES[category]}</h1>
        <span className="count-badge">{drinks.length} {drinks.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      <DrinkTable category={category} drinks={drinks} onEdit={handleEdit} />
    </div>
  );
}
