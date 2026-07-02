import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RatingHistogram from '../../components/RatingHistogram';
import { buildRatingHistogram } from '../../utils/analyticsHelpers';
import './RatingSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function RatingSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const navigate = useNavigate();
  const category = override ?? globalCategory;

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const buckets = buildRatingHistogram(scoped);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  const handleBarClick = ({ min, max }) => {
    navigate(`/${category}?avgRatingMin=${min}&avgRatingMax=${max}`);
  };

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="count-badge">{total} rated {total === 1 ? 'drink' : 'drinks'}</span>
        <div className="category-tabs" data-testid="rating-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {total === 0
        ? <p className="empty-state">No rated drinks yet.</p>
        : <RatingHistogram buckets={buckets} onBarClick={handleBarClick} />}
    </div>
  );
}
