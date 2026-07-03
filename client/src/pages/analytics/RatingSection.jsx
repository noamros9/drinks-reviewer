import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RatingHistogram from '../../components/RatingHistogram';
import StatTileRow from '../../components/StatTileRow';
import TrendLineChart from '../../components/TrendLineChart';
import CategoryBarChart from '../../components/CategoryBarChart';
import ConsistencyLeaderboard from './ConsistencyLeaderboard';
import {
  buildRatingHistogram, computePercentiles, buildRatingTrend,
  buildCategoryComparison, buildConsistencyLeaderboard,
} from '../../utils/analyticsHelpers';
import './RatingSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function RatingSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const navigate = useNavigate();
  const category = override ?? globalCategory;

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const buckets = buildRatingHistogram(scoped);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  const percentiles = computePercentiles(scoped);
  const trend = buildRatingTrend(scoped);
  const comparison = buildCategoryComparison(drinks);
  const leaderboard = buildConsistencyLeaderboard(scoped, 5);

  const handleBarClick = ({ min, max }) => {
    navigate(`/${category}?avgRatingMin=${min}&avgRatingMax=${max}`);
  };

  const handleCategoryBarClick = (cat) => {
    navigate(`/${cat}`);
  };

  const handlePercentileClick = (threshold) => {
    navigate(`/${category}?avgRatingMin=${threshold}`);
  };

  const handleSelectDrink = (entry) => {
    navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });
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
        : (
          <>
            <RatingHistogram buckets={buckets} onBarClick={handleBarClick} />

            <h3 className="analytics-subsection-title">Rating Percentiles</h3>
            <StatTileRow tiles={percentiles.map(p => ({
              label: `≥ ${p.threshold}`,
              value: `${p.pct}%`,
              onClick: () => handlePercentileClick(p.threshold),
            }))} />

            <h3 className="analytics-subsection-title">Rating Over Time</h3>
            <TrendLineChart data={trend} />

            <h3 className="analytics-subsection-title">
              By Category <span className="scope-note">(always all categories)</span>
            </h3>
            <CategoryBarChart
              data={comparison} onBarClick={handleCategoryBarClick}
              dataKey="avgRating" domain={[0, 10]} emptyLabel="no rated drinks"
              describeBar={(label, value) => `${label}: average rating ${value}`}
              describeTooltip={(label, value, count) => <><strong>{value}</strong> avg — {label} ({count} rated)</>}
            />

            <h3 className="analytics-subsection-title">Consistency</h3>
            <ConsistencyLeaderboard {...leaderboard} onSelectDrink={handleSelectDrink} />
          </>
        )}
    </div>
  );
}
