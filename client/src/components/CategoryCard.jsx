import { Link } from 'react-router-dom';

const META = {
  collection: { icon: '🗄️', label: 'Cellar', path: '/cellar' },
  wine:       { icon: '🍷', label: 'Wine Reviews' },
  beer:       { icon: '🍺', label: 'Beer Reviews' },
  whiskey:    { icon: '🥃', label: 'Whiskey Reviews' },
  others:     { icon: '🍹', label: 'Other Reviews' },
};

export default function CategoryCard({ category, count }) {
  const { icon, label, path } = META[category];
  return (
    <Link to={path ?? `/${category}`} className="category-card">
      <span className="category-icon">{icon}</span>
      <span className="category-label">{label}</span>
      <span className="category-count">{count} {count === 1 ? 'entry' : 'entries'}</span>
    </Link>
  );
}
