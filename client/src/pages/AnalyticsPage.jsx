import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RatingSection from './analytics/RatingSection';
import AbvSection from './analytics/AbvSection';
import GeographicSection from './analytics/GeographicSection';
import TimePaceSection from './analytics/TimePaceSection';
import StyleSection from './analytics/StyleSection';
import ExplorationSection from './analytics/ExplorationSection';

const SECTIONS = [
  { key: 'rating', label: 'Rating', Component: RatingSection },
  { key: 'abv', label: 'ABV', Component: AbvSection },
  { key: 'geographic', label: 'Geographic', Component: GeographicSection },
  { key: 'timepace', label: 'Time & Pace', Component: TimePaceSection },
  { key: 'style', label: 'Style & Variety', Component: StyleSection },
  { key: 'exploration', label: 'Exploration', Component: ExplorationSection },
];

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function AnalyticsPage() {
  const [drinks, setDrinks] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = SECTIONS.some(s => s.key === searchParams.get('tab')) ? searchParams.get('tab') : SECTIONS[0].key;
  const [globalCategory, setGlobalCategory] = useState('all');

  useEffect(() => {
    Promise.all(
      ['wine', 'beer', 'whiskey', 'others'].map(cat =>
        fetch(`/api/${cat}`)
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(data => data.map(d => ({ ...d, _category: cat })))
          .catch(() => [])
      )
    ).then(results => setDrinks(results.flat()));
  }, []);

  const ActiveSection = SECTIONS.find(s => s.key === tab)?.Component ?? SECTIONS[0].Component;

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>Analytics</h1>
      </div>
      <div className="category-tabs">
        {SECTIONS.map(s => (
          <button key={s.key} className={tab === s.key ? 'active' : ''} onClick={() => setSearchParams({ tab: s.key })}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="category-tabs" data-testid="global-category-filter">
        {CATEGORY_FILTERS.map(c => (
          <button key={c} className={globalCategory === c ? 'active' : ''} onClick={() => setGlobalCategory(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      <ActiveSection drinks={drinks} globalCategory={globalCategory} />
    </div>
  );
}
