import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './RatingHistogram.css';

function BarBackground({ x, y, width, height, payload, onBarClick }) {
  const activate = () => onBarClick({ min: payload.min, max: payload.max });
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      className="rating-histogram-bar"
      data-testid={`bar-${payload.min}-${payload.max}`}
      role="button"
      tabIndex={0}
      aria-label={`${payload.count} ${payload.count === 1 ? 'drink' : 'drinks'} rated ${payload.min} to ${payload.max}`}
      onClick={activate}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
    />
  );
}

function BarValue({ x, y, width, height }) {
  return <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="var(--accent)" pointerEvents="none" />;
}

export function HistogramTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { min, max, count } = payload[0].payload;
  return (
    <div className="rating-histogram-tooltip">
      <strong>{count}</strong> {count === 1 ? 'drink' : 'drinks'} rated {min}–{max}
    </div>
  );
}

export default function RatingHistogram({ buckets, onBarClick }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <YAxis allowDecimals={false} width={32} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <Tooltip content={<HistogramTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.5 }} />
        <Bar
          dataKey="count"
          barSize={24}
          isAnimationActive={false}
          shape={<BarValue />}
          background={<BarBackground onBarClick={onBarClick} />}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
