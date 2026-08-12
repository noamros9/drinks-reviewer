import AbvRatingScatter from '../../components/AbvRatingScatter';
import CategoryBarChart from '../../components/CategoryBarChart';
import BestValueLeaderboard from './BestValueLeaderboard';
import RebuyLeaderboard from './RebuyLeaderboard';
import AvgPriceByCountryTable from './AvgPriceByCountryTable';
import {
  buildPriceRatingScatter, buildBestValue, buildRebuyList, buildPriceBands,
  buildAvgPriceCategoryComparison, buildAvgPriceByCountry, formatPrice, median,
} from '../../utils/analyticsHelpers';
import './RatingSection.css';

const SCATTER_X_AXIS_PROPS = { scale: 'log', domain: ['auto', 'auto'], ticks: [10, 25, 50, 100, 250, 500] };

// Diverging: near-grey at the neutral score of 50, saturating to green (bargain) or red
// (overpriced). Value scores cluster around 50, so a plain red->green hue ramp would render
// most of the chart mustard -- the mid-range is exactly where the mass sits.
function valueFill(score) {
  const t = ((score ?? 50) - 50) / 50;
  return `hsl(${t >= 0 ? 145 : 5}, ${Math.round(Math.abs(t) * 75)}%, 48%)`;
}

function adminUrl(entry) {
  return `/admin?id=${entry.id}&category=${entry.category}&tab=tastings`;
}

export default function ValueSection({ drinks, globalCategory }) {
  const category = globalCategory;

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);

  const valueRows = buildBestValue(scoped, Infinity);
  const scoreById = new Map(valueRows.map(r => [r.id, r.valueScore]));
  const scatterPoints = buildPriceRatingScatter(scoped).map(p => ({ ...p, valueScore: scoreById.get(p.id) }));
  const rebuy = buildRebuyList(scoped, Infinity);
  const priceByCategory = buildAvgPriceCategoryComparison(drinks);
  const priceByCountry = buildAvgPriceByCountry(scoped);
  const priceBands = category === 'all' ? [] : buildPriceBands(scoped);
  const unpricedCount = scoped.length - scatterPoints.length;
  const medianX = scatterPoints.length ? median(scatterPoints.map(p => p.price)) : undefined;
  const medianY = scatterPoints.length ? median(scatterPoints.map(p => p.rating)) : undefined;

  const handleSelectDrink = (entry) => {
    window.open(adminUrl(entry), '_blank');
  };

  const handleCategoryBarClick = (cat) => {
    window.open(`/${cat}`, '_blank');
  };

  const handleSelectCountry = (country) => {
    window.open(`/${category}?country=${encodeURIComponent(country)}`, '_blank');
  };

  return (
    <div className="analytics-section">
      <h3 className="analytics-subsection-title">Worth Restocking</h3>
      <RebuyLeaderboard rows={rebuy} adminUrl={adminUrl} />

      <h3 className="analytics-subsection-title">Price vs Rating</h3>
      {scatterPoints.length === 0
        ? <p className="empty-state">No price data yet.</p>
        : (
          <>
            <AbvRatingScatter
              points={scatterPoints} onPointClick={handleSelectDrink} xKey="price" xLabel="Price" xUnit=" ₪"
              xAxisProps={SCATTER_X_AXIS_PROPS}
              pointStyle={p => ({ fill: valueFill(p.valueScore), hollow: p.priceIsEstimated })}
              medians={{ x: medianX, y: medianY }}
            />
            <div className="value-scatter-legend">
              <div className="value-scatter-legend-gradient">
                <span>Overpriced</span>
                <span className="value-scatter-legend-bar" />
                <span>Great value</span>
              </div>
              <div className="value-scatter-legend-markers">
                <span className="value-scatter-legend-dot" />paid
                <span className="value-scatter-legend-dot hollow" />estimated
              </div>
              <span>dashed lines = median price/rating in this view</span>
            </div>
          </>
        )}
      {unpricedCount > 0 && (
        <p className="scope-note">{unpricedCount} drink{unpricedCount === 1 ? '' : 's'} not shown above — no price recorded.</p>
      )}

      <h3 className="analytics-subsection-title">
        Best Value <span className="scope-note">(0-100, within-category rating percentile vs price percentile; 50 = neutral)</span>
      </h3>
      <BestValueLeaderboard rows={valueRows} adminUrl={adminUrl} />

      {category !== 'all' && (
        <>
          <h3 className="analytics-subsection-title">Does Paying More Help?</h3>
          {priceBands.length === 0
            ? <p className="empty-state">Not enough priced drinks in this category yet.</p>
            : (
              <CategoryBarChart
                data={priceBands} onBarClick={() => {}}
                dataKey="avgRating" domain={[0, 10]} emptyLabel="no drinks in this band"
                describeBar={(label, value) => `${label}: average rating ${value}`}
                describeTooltip={(label, value, count) => <><strong>{value}</strong> avg rating — {label} ({count} drinks)</>}
              />
            )}
        </>
      )}

      <h3 className="analytics-subsection-title">
        Avg Price by Category <span className="scope-note">(always all categories)</span>
      </h3>
      <CategoryBarChart
        data={priceByCategory} onBarClick={handleCategoryBarClick}
        dataKey="avgPrice" domain={[0, 'dataMax']} yAxisWidth={48} emptyLabel="no priced drinks"
        describeBar={(label, value) => `${label}: average price ${formatPrice(value)}`}
        describeTooltip={(label, value, count) => <><strong>{formatPrice(value)}</strong> avg price — {label} ({count} drinks)</>}
      />

      <h3 className="analytics-subsection-title">Avg Price by Country</h3>
      <AvgPriceByCountryTable rows={priceByCountry} onSelectCountry={handleSelectCountry} />
    </div>
  );
}
