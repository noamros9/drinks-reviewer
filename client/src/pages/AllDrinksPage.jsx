import { useEffect, useState } from 'react';
import DrinkTable from '../components/DrinkTable';

const FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

function normalize(entries, category) {
  return entries.map(entry => ({
    ...entry,
    _category: category.charAt(0).toUpperCase() + category.slice(1),
    _producer: entry.producer ?? entry.brewery ?? entry.distillery ?? '—',
    name: entry.seriesAndName ?? entry.name,
  }));
}

export default function AllDrinksPage() {
  const [drinks, setDrinks] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all(
      ['wine', 'beer', 'whiskey', 'others'].map(cat =>
        fetch(`/api/${cat}`).then(r => r.json()).then(data => normalize(data, cat))
      )
    ).then(results => setDrinks(results.flat())).catch(() => {});
  }, []);

  const visible = filter === 'all'
    ? drinks
    : drinks.filter(d => d._category.toLowerCase() === filter);

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>All Drinks</h1>
        <span className="count-badge">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}</span>
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
      <DrinkTable category="all" drinks={visible} />
    </div>
  );
}
