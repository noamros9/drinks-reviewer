import { useState } from 'react';
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

const Y_MODES = [
  { key: 'avgRating', label: 'Avg Rating', field: 'rating', domain: ['dataMin - 0.5', 'dataMax + 0.5'], jitter: true },
  { key: 'weightedRating', label: 'Weighted Rating', field: 'weightedRating', domain: ['dataMin - 0.5', 'dataMax + 0.5'], jitter: true },
  { key: 'valueScore', label: 'Value Score', field: 'valueScore', domain: [0, 100], jitter: false },
];

const QUADRANT_LABELS = { topLeft: 'Bargains', topRight: 'Worth It', bottomLeft: 'Skip', bottomRight: 'Overpriced' };

// Deterministic per-id nudge, well inside the 0.5 rating-quantization step, so overlapping
// points separate without a point ever crossing into a neighbouring rating band.
function seededJitter(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * 0.24 - 0.12;
}

// Diverging: 7 discrete steps (overpriced -> neutral -> great value). Value scores cluster
// around 50, so a smooth ramp turns to mush there -- discrete bands keep it legible.
function valueFill(score) {
  const clamped = Math.max(0, Math.min(100, score ?? 50));
  const step = Math.min(6, Math.floor(clamped / (100 / 7)));
  return `var(--value-diverging-${step + 1})`;
}

function adminUrl(entry) {
  return `/admin?id=${entry.id}&category=${entry.category}&tab=tastings`;
}

export default function ValueSection({ drinks, globalCategory }) {
  const category = globalCategory;
  const [yMode, setYMode] = useState('avgRating');
  const mode = Y_MODES.find(m => m.key === yMode);

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);

  const valueRows = buildBestValue(scoped, Infinity);
  const scoreById = new Map(valueRows.map(r => [r.id, { weightedRating: r.weightedRating, valueScore: r.valueScore }]));
  const scatterPoints = buildPriceRatingScatter(scoped).map(p => ({ ...p, ...scoreById.get(p.id) }));
  const plottedPoints = scatterPoints.map(p => ({
    ...p, plotY: mode.jitter ? p[mode.field] + seededJitter(p.id) : p[mode.field],
  }));
  const rebuy = buildRebuyList(scoped, Infinity);
  const priceByCategory = buildAvgPriceCategoryComparison(drinks);
  const priceByCountry = buildAvgPriceByCountry(scoped);
  const priceBands = category === 'all' ? [] : buildPriceBands(scoped);
  const unpricedCount = scoped.length - scatterPoints.length;
  const medianX = scatterPoints.length ? median(scatterPoints.map(p => p.price)) : undefined;
  const medianY = scatterPoints.length ? median(scatterPoints.map(p => p[mode.field])) : undefined;

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
            <div className="value-scatter-toggle" role="group" aria-label="Y axis">
              {Y_MODES.map(m => (
                <button
                  key={m.key} type="button" className={m.key === yMode ? 'active' : ''}
                  onClick={() => setYMode(m.key)}
                  aria-pressed={m.key === yMode}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <AbvRatingScatter
              points={plottedPoints} onPointClick={handleSelectDrink} xKey="price" xLabel="Price" xUnit=" ₪"
              xAxisProps={SCATTER_X_AXIS_PROPS}
              yKey="plotY" yDomain={mode.domain} ring fillOpacity={1}
              pointStyle={p => ({
                fill: valueFill(p.valueScore),
                hollow: p.priceIsEstimated,
              })}
              medians={{ x: medianX, y: medianY }}
              extraTooltipFields={[{ key: 'weightedRating', label: 'Weighted Rating' }]}
              quadrantLabels={QUADRANT_LABELS}
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
              <span>dashed lines = median price/{mode.label.toLowerCase()} in this view</span>
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
