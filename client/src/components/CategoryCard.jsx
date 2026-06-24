import { Link } from 'react-router-dom';

const META = {
  wine:    { icon: '🍷', label: 'Wine' },
  beer:    { icon: '🍺', label: 'Beer' },
  whiskey: { icon: '🥃', label: 'Whiskey' },
  others:  { icon: '🍹', label: 'Others' },
};

export default function CategoryCard({ category, count }) {
  const { icon, label } = META[category];
  return (
    <Link to={`/${category}`} className="category-card">
      <span className="category-icon">{icon}</span>
      <span className="category-label">{label}</span>
      <span className="category-count">{count} {count === 1 ? 'entry' : 'entries'}</span>
    </Link>
  );
}
