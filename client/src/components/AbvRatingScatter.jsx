import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './AbvRatingScatter.css';

function Point({ cx, cy, payload, onPointClick }) {
  const activate = () => onPointClick(payload);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      className="abv-rating-scatter-point"
      data-testid={`point-${payload.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${payload.label}: ABV ${payload.abv}%, rating ${payload.rating}`}
      onClick={activate}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
    />
  );
}

export function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { label, abv, rating } = payload[0].payload;
  return (
    <div className="abv-rating-scatter-tooltip">
      <strong>{label}</strong> — ABV {abv}%, rating {rating}
    </div>
  );
}

export default function AbvRatingScatter({ points, onPointClick }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="abv"
          name="ABV"
          unit="%"
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
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
        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={points} isAnimationActive={false} shape={<Point onPointClick={onPointClick} />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
