import { useEffect, useState } from 'react';
import CategoryCard from '../components/CategoryCard';
import { CATEGORIES } from '../utils/filterHelpers';
import './Home.css';

const CARDS = ['collection', ...CATEGORIES];

export default function Home() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    CARDS.forEach(cat => {
      fetch(`/api/${cat}`)
        .then(r => r.json())
        .then(data => setCounts(prev => ({ ...prev, [cat]: data.length })))
        .catch(() => {});
    });
  }, []);

  return (
    <div className="home">
      <h1>My Drinks Journal</h1>
      <div className="category-grid">
        {CARDS.map(cat => (
          <CategoryCard key={cat} category={cat} count={counts[cat] ?? 0} />
        ))}
      </div>
    </div>
  );
}
