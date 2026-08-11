import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import './AbvRatingScatter.css';

function Point({ cx, cy, payload, onPointClick, xKey, xLabel, xUnit, pointStyle }) {
  const activate = () => onPointClick(payload);
  const { fill, hollow } = pointStyle ? pointStyle(payload) : {};
  const style = pointStyle ? { fill: hollow ? 'none' : fill, stroke: fill, strokeWidth: 2 } : undefined;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      className="abv-rating-scatter-point"
      style={style}
      data-testid={`point-${payload.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${payload.label}: ${xLabel} ${payload[xKey]}${xUnit}, rating ${payload.rating}${hollow ? ' (estimated price)' : ''}`}
      onClick={activate}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
    />
  );
}

export function ScatterTooltip({ active, payload, xKey = 'abv', xLabel = 'ABV', xUnit = '%' }) {
  if (!active || !payload?.length) return null;
  const { label, rating } = payload[0].payload;
  const xValue = payload[0].payload[xKey];
  return (
    <div className="abv-rating-scatter-tooltip">
      <strong>{label}</strong> — {xLabel} {xValue}{xUnit}, rating {rating}
    </div>
  );
}

// Generalized via xKey/xLabel/xUnit so any numeric axis (not just ABV) can reuse this
// chart — charts here generalize on their 2nd use, while leaderboard tables deliberately
// don't (see RevisitLeaderboard/BestOfLeaderboard).
export default function AbvRatingScatter({
  points, onPointClick, xKey = 'abv', xLabel = 'ABV', xUnit = '%', xAxisProps, pointStyle, medians,
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey={xKey}
          name={xLabel}
          unit={xUnit}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          {...xAxisProps}
        />
        <YAxis
          type="number"
          dataKey="rating"
          name="Rating"
          domain={[0, 10]}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <Tooltip content={<ScatterTooltip xKey={xKey} xLabel={xLabel} xUnit={xUnit} />} cursor={{ strokeDasharray: '3 3' }} />
        {Number.isFinite(medians?.x) && <ReferenceLine x={medians.x} stroke="var(--text-secondary)" strokeDasharray="4 4" />}
        {Number.isFinite(medians?.y) && <ReferenceLine y={medians.y} stroke="var(--text-secondary)" strokeDasharray="4 4" />}
        <Scatter
          data={points}
          isAnimationActive={false}
          fillOpacity={0.85}
          shape={<Point onPointClick={onPointClick} xKey={xKey} xLabel={xLabel} xUnit={xUnit} pointStyle={pointStyle} />}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
