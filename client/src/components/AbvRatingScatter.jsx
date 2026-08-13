import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import './AbvRatingScatter.css';

function Point({ cx, cy, payload, onPointClick, xKey, xLabel, xUnit, yKey, yLabel, pointStyle, ring }) {
  const activate = () => onPointClick(payload);
  const { fill, hollow } = pointStyle ? pointStyle(payload) : {};
  const style = pointStyle ? { fill: hollow ? 'none' : fill, stroke: fill, strokeWidth: 2 } : undefined;
  return (
    <g>
      {ring && <circle cx={cx} cy={cy} r={6.5} fill="var(--bg)" />}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        className="abv-rating-scatter-point"
        style={style}
        data-testid={`point-${payload.id}`}
        role="button"
        tabIndex={0}
        aria-label={`${payload.label}: ${xLabel} ${payload[xKey]}${xUnit}, ${yLabel} ${payload[yKey]}${hollow ? ' (estimated price)' : ''}`}
        onClick={activate}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        }}
      />
    </g>
  );
}

export function ScatterTooltip({ active, payload, xKey = 'abv', xLabel = 'ABV', xUnit = '%', formatX, yKey = 'rating', yLabel = 'rating', showX = true, pointStyle, extraFields }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const { hollow } = pointStyle ? pointStyle(p) : {};
  const xValue = formatX ? formatX(p[xKey]) : `${p[xKey]}${xUnit}`;
  return (
    <div className="abv-rating-scatter-tooltip">
      <strong>{p.label}</strong>
      {showX && (
        <div className="abv-rating-scatter-tooltip-row">
          <span className="abv-rating-scatter-tooltip-label">{xLabel}</span>
          <span className="abv-rating-scatter-tooltip-value">{xValue}{hollow ? ' (est.)' : ''}</span>
        </div>
      )}
      <div className="abv-rating-scatter-tooltip-row">
        <span className="abv-rating-scatter-tooltip-label">{yLabel}</span>
        <span className="abv-rating-scatter-tooltip-value">{p[yKey]}</span>
      </div>
      {extraFields?.map(f => (
        <div key={f.key} className="abv-rating-scatter-tooltip-row">
          <span className="abv-rating-scatter-tooltip-label">{f.label}</span>
          <span className="abv-rating-scatter-tooltip-value">{p[f.key]}</span>
        </div>
      ))}
    </div>
  );
}

// Generalized via xKey/xLabel/xUnit so any numeric axis (not just ABV) can reuse this
// chart — charts here generalize on their 2nd use, while leaderboard tables deliberately
// don't (see RevisitLeaderboard/BestOfLeaderboard).
export default function AbvRatingScatter({
  points, onPointClick, xKey = 'abv', xLabel = 'ABV', xUnit = '%', formatX, xAxisProps, pointStyle, medians,
  yKey = 'rating', tooltipYKey = yKey, yLabel = 'rating', tooltipShowX = true, yDomain = [0, 10], ring = false,
  fillOpacity = 0.85, extraTooltipFields, quadrantLabels,
}) {
  return (
    <div className="abv-rating-scatter-wrap">
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
            dataKey={yKey}
            name="Rating"
            domain={yDomain}
            allowDecimals={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <Tooltip content={<ScatterTooltip xKey={xKey} xLabel={xLabel} xUnit={xUnit} formatX={formatX} yKey={tooltipYKey} yLabel={yLabel} showX={tooltipShowX} pointStyle={pointStyle} extraFields={extraTooltipFields} />} cursor={{ strokeDasharray: '3 3' }} />
          {Number.isFinite(medians?.x) && <ReferenceLine x={medians.x} stroke="var(--text-secondary)" strokeDasharray="4 4" />}
          {Number.isFinite(medians?.y) && <ReferenceLine y={medians.y} stroke="var(--text-secondary)" strokeDasharray="4 4" />}
          <Scatter
            data={points}
            isAnimationActive={false}
            fillOpacity={fillOpacity}
            shape={<Point onPointClick={onPointClick} xKey={xKey} xLabel={xLabel} xUnit={xUnit} yKey={tooltipYKey} yLabel={yLabel} pointStyle={pointStyle} ring={ring} />}
          />
        </ScatterChart>
      </ResponsiveContainer>
      {quadrantLabels && (
        <>
          <span className="scatter-quadrant scatter-quadrant-tl">{quadrantLabels.topLeft}</span>
          <span className="scatter-quadrant scatter-quadrant-tr">{quadrantLabels.topRight}</span>
          <span className="scatter-quadrant scatter-quadrant-bl">{quadrantLabels.bottomLeft}</span>
          <span className="scatter-quadrant scatter-quadrant-br">{quadrantLabels.bottomRight}</span>
        </>
      )}
    </div>
  );
}
