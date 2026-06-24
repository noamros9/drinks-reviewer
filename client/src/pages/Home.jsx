import { useEffect, useState } from 'react';
import CategoryCard from '../components/CategoryCard';

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

export default function Home() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    CATEGORIES.forEach(cat => {
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
        {CATEGORIES.map(cat => (
          <CategoryCard key={cat} category={cat} count={counts[cat] ?? 0} />
        ))}
      </div>
    </div>
  );
}
