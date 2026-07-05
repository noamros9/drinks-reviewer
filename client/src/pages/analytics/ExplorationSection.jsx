import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BestOfLeaderboard from './BestOfLeaderboard';
import { buildBestOf } from '../../utils/analyticsHelpers';
import './RatingSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function ExplorationSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const navigate = useNavigate();
  const category = override ?? globalCategory;

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const bestOf = buildBestOf(scoped, 10);

  const handleSelectDrink = (entry) => {
    navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });
  };

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div className="category-tabs" data-testid="exploration-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <h3 className="analytics-subsection-title">Best Of (weighted rating)</h3>
      <BestOfLeaderboard rows={bestOf} onSelectDrink={handleSelectDrink} />
    </div>
  );
}
