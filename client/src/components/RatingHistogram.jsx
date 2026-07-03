import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './RatingHistogram.css';

const defaultDescribeBar = (count, min, max) => `${count} ${count === 1 ? 'drink' : 'drinks'} rated ${min} to ${max}`;
const defaultDescribeTooltip = (count, min, max) => `${count === 1 ? 'drink' : 'drinks'} rated ${min}–${max}`;

function BarBackground({ x, y, width, height, payload, onBarClick, describeBar }) {
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
      aria-label={describeBar(payload.count, payload.min, payload.max)}
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

export function HistogramTooltip({ active, payload, describe = defaultDescribeTooltip }) {
  if (!active || !payload?.length) return null;
  const { min, max, count } = payload[0].payload;
  return (
    <div className="rating-histogram-tooltip">
      <strong>{count}</strong> {describe(count, min, max)}
    </div>
  );
}

export default function RatingHistogram({ buckets, onBarClick, describeBar = defaultDescribeBar, describeTooltip }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <YAxis allowDecimals={false} width={32} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <Tooltip content={<HistogramTooltip describe={describeTooltip} />} cursor={{ fill: 'var(--border)', opacity: 0.5 }} />
        <Bar
          dataKey="count"
          barSize={24}
          isAnimationActive={false}
          shape={<BarValue />}
          background={<BarBackground onBarClick={onBarClick} describeBar={describeBar} />}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
