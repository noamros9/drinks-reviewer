import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RatingHistogram from '../../components/RatingHistogram';
import CategoryBarChart from '../../components/CategoryBarChart';
import AbvRatingScatter from '../../components/AbvRatingScatter';
import { buildAbvHistogram, buildAbvVsRatingScatter, buildAbvCategoryComparison } from '../../utils/analyticsHelpers';
import './RatingSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function AbvSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const navigate = useNavigate();
  const category = override ?? globalCategory;

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const buckets = buildAbvHistogram(scoped);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  const scatterPoints = buildAbvVsRatingScatter(scoped);
  const abvComparison = buildAbvCategoryComparison(drinks);

  const handleBarClick = ({ min, max }) => {
    window.open(`/${category}?abvMin=${min}&abvMax=${max}`, '_blank');
  };

  const handleCategoryBarClick = (cat) => {
    window.open(`/${cat}`, '_blank');
  };

  const handleSelectDrink = (entry) => {
    navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });
  };

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="count-badge">{total} {total === 1 ? 'drink' : 'drinks'} with ABV data</span>
        <div className="category-tabs" data-testid="abv-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {total === 0
        ? <p className="empty-state">No ABV data yet.</p>
        : (
          <>
            <RatingHistogram
              buckets={buckets} onBarClick={handleBarClick}
              describeBar={(count, min, max) => `${count} ${count === 1 ? 'drink' : 'drinks'} with ABV ${min} to ${max}%`}
              describeTooltip={(count, min, max) => `${count === 1 ? 'drink' : 'drinks'} with ABV ${min}–${max}%`}
            />

            <h3 className="analytics-subsection-title">ABV vs Rating</h3>
            <AbvRatingScatter points={scatterPoints} onPointClick={handleSelectDrink} />

            <h3 className="analytics-subsection-title">
              By Category <span className="scope-note">(always all categories)</span>
            </h3>
            <CategoryBarChart
              data={abvComparison} onBarClick={handleCategoryBarClick}
              dataKey="avgAbv" domain={[0, 'dataMax']} emptyLabel="no ABV data"
              describeBar={(label, value) => `${label}: average ABV ${value}%`}
              describeTooltip={(label, value, count) => <><strong>{value}%</strong> avg ABV — {label} ({count} drinks)</>}
            />
          </>
        )}
    </div>
  );
}
