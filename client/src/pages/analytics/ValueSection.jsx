import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AbvRatingScatter from '../../components/AbvRatingScatter';
import CategoryBarChart from '../../components/CategoryBarChart';
import BestValueLeaderboard from './BestValueLeaderboard';
import AvgPriceByCountryTable from './AvgPriceByCountryTable';
import {
  buildPriceRatingScatter, buildBestValue, buildAvgPriceCategoryComparison, buildAvgPriceByCountry,
} from '../../utils/analyticsHelpers';
import './RatingSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function ValueSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const navigate = useNavigate();
  const category = override ?? globalCategory;

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const scatterPoints = buildPriceRatingScatter(scoped);
  const bestValue = buildBestValue(scoped);
  const priceByCategory = buildAvgPriceCategoryComparison(drinks);
  const priceByCountry = buildAvgPriceByCountry(scoped);

  const handleSelectDrink = (entry) => {
    navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });
  };

  const handleCategoryBarClick = (cat) => {
    window.open(`/${cat}`, '_blank');
  };

  const handleSelectCountry = (country) => {
    window.open(`/${category}?country=${encodeURIComponent(country)}`, '_blank');
  };

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div className="category-tabs" data-testid="value-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <h3 className="analytics-subsection-title">Price vs Rating</h3>
      {scatterPoints.length === 0
        ? <p className="empty-state">No price data yet.</p>
        : <AbvRatingScatter points={scatterPoints} onPointClick={handleSelectDrink} xKey="price" xLabel="Price" xUnit="" />}

      <h3 className="analytics-subsection-title">
        Best Value <span className="scope-note">(weighted rating ÷ avg price)</span>
      </h3>
      <BestValueLeaderboard rows={bestValue} onSelectDrink={handleSelectDrink} />

      <h3 className="analytics-subsection-title">
        Avg Price by Category <span className="scope-note">(always all categories)</span>
      </h3>
      <CategoryBarChart
        data={priceByCategory} onBarClick={handleCategoryBarClick}
        dataKey="avgPrice" domain={[0, 'dataMax']} emptyLabel="no priced drinks"
        describeBar={(label, value) => `${label}: average price ${value}`}
        describeTooltip={(label, value, count) => <><strong>{value}</strong> avg price — {label} ({count} drinks)</>}
      />

      <h3 className="analytics-subsection-title">Avg Price by Country</h3>
      <AvgPriceByCountryTable rows={priceByCountry} onSelectCountry={handleSelectCountry} />
    </div>
  );
}
