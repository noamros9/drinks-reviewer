import { useNavigate } from 'react-router-dom';
import RatingHistogram from '../../components/RatingHistogram';
import StatTileRow from '../../components/StatTileRow';
import TrendLineChart from '../../components/TrendLineChart';
import CategoryBarChart from '../../components/CategoryBarChart';
import ScopeTabs from '../../components/ScopeTabs';
import ConsistencyLeaderboard from './ConsistencyLeaderboard';
import { useScopeCategory } from '../../hooks/useScopeCategory';
import {
  buildRatingHistogram, computePercentiles, buildRatingTrend,
  buildCategoryComparison, buildConsistencyLeaderboard, RATING_BUCKETS,
} from '../../utils/analyticsHelpers';
import './RatingSection.css';

export default function RatingSection({ drinks, globalCategory }) {
  const [category, setOverride] = useScopeCategory(globalCategory);
  const navigate = useNavigate();

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const buckets = buildRatingHistogram(scoped);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  const percentiles = computePercentiles(scoped);
  const trend = buildRatingTrend(scoped);
  const comparison = buildCategoryComparison(drinks);
  const leaderboard = buildConsistencyLeaderboard(scoped, 5);

  const handleBarClick = ({ min, max }) => {
    const isLastBucket = max >= RATING_BUCKETS[RATING_BUCKETS.length - 1].max;
    const avgRatingMax = isLastBucket ? max : max - 0.01;
    window.open(`/${category}?avgRatingMin=${min}&avgRatingMax=${avgRatingMax}`, '_blank');
  };

  const handleCategoryBarClick = (cat) => {
    window.open(`/${cat}`, '_blank');
  };

  const handlePercentileClick = (threshold) => {
    window.open(`/${category}?avgRatingMin=${threshold}`, '_blank');
  };

  const handleSelectDrink = (entry) => {
    navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });
  };

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="count-badge">{total} rated {total === 1 ? 'drink' : 'drinks'}</span>
        <ScopeTabs category={category} onChange={setOverride} testId="rating-category-filter" />
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
