import { useNavigate } from 'react-router-dom';
import AbvRatingScatter from '../../components/AbvRatingScatter';
import CategoryBarChart from '../../components/CategoryBarChart';
import ScopeTabs from '../../components/ScopeTabs';
import BestValueLeaderboard from './BestValueLeaderboard';
import AvgPriceByCountryTable from './AvgPriceByCountryTable';
import { useScopeCategory } from '../../hooks/useScopeCategory';
import {
  buildPriceRatingScatter, buildBestValue, buildAvgPriceCategoryComparison, buildAvgPriceByCountry,
} from '../../utils/analyticsHelpers';
import './RatingSection.css';

export default function ValueSection({ drinks, globalCategory }) {
  const [category, setOverride] = useScopeCategory(globalCategory);
  const navigate = useNavigate();

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
        <ScopeTabs category={category} onChange={setOverride} testId="value-category-filter" />
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
