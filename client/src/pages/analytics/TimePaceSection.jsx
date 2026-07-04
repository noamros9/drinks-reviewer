import { useState } from 'react';
import TrendLineChart from '../../components/TrendLineChart';
import { buildDiscoveryPace, buildSeasonalPattern, buildCategoryTrend } from '../../utils/analyticsHelpers';
import './RatingSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const CATEGORY_TREND_SERIES = [
  { dataKey: 'wine', color: 'var(--cat-wine)', label: 'Wine' },
  { dataKey: 'beer', color: 'var(--cat-beer)', label: 'Beer' },
  { dataKey: 'whiskey', color: 'var(--cat-whiskey)', label: 'Whiskey' },
  { dataKey: 'others', color: 'var(--cat-others)', label: 'Others' },
];

export default function TimePaceSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const category = override ?? globalCategory;
  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);

  const total = scoped.filter(d => (d.tastings || []).length > 0).length;
  const discoveryPace = buildDiscoveryPace(scoped);
  const seasonalPattern = buildSeasonalPattern(scoped);
  const categoryTrend = buildCategoryTrend(drinks);

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="count-badge">{total} tasted {total === 1 ? 'drink' : 'drinks'}</span>
        <div className="category-tabs" data-testid="timepace-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {total === 0
        ? <p className="empty-state">No tastings logged yet.</p>
        : (
          <>
            <h3 className="analytics-subsection-title">Discovery Pace</h3>
            <TrendLineChart
              data={discoveryPace}
              series={[{ dataKey: 'count', color: 'var(--accent)', label: 'New drinks' }]}
              yDomain={[0, 'dataMax']} yAllowDecimals={false}
              describeTooltip={row => <><strong>{row.count}</strong> new {row.count === 1 ? 'drink' : 'drinks'} — {row.month}</>}
            />

            <h3 className="analytics-subsection-title">Seasonal Patterns</h3>
            <TrendLineChart
              data={seasonalPattern}
              series={[{ dataKey: 'count', color: 'var(--accent)', label: 'Tastings' }]}
              yDomain={[0, 'dataMax']} yAllowDecimals={false} xTickInterval={0}
              describeTooltip={row => <><strong>{row.count}</strong> {row.count === 1 ? 'tasting' : 'tastings'} — {row.month}</>}
            />

            <h3 className="analytics-subsection-title">
              Category Trend <span className="scope-note">(always all categories)</span>
            </h3>
            <TrendLineChart
              data={categoryTrend}
              series={CATEGORY_TREND_SERIES}
              yDomain={[0, 'dataMax']} yAllowDecimals={false}
              describeTooltip={row => (
                <>
                  <div>{row.month}</div>
                  {CATEGORY_TREND_SERIES.map(s => (
                    <div key={s.dataKey}><span style={{ color: s.color }}>●</span> {s.label}: <strong>{row[s.dataKey] ?? 0}</strong></div>
                  ))}
                </>
              )}
            />
          </>
        )}
    </div>
  );
}
