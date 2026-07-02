import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './CategoryBarChart.css';

function BarBackground({ x, y, width, height, payload, onBarClick }) {
  const activate = () => onBarClick(payload.category);
  const label = payload.category.charAt(0).toUpperCase() + payload.category.slice(1);
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      className="category-bar-chart-bar"
      data-testid={`bar-${payload.category}`}
      role="button"
      tabIndex={0}
      aria-label={payload.count === 0 ? `${label}: no rated drinks` : `${label}: average rating ${payload.avgRating}`}
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

export function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { category, avgRating, count } = payload[0].payload;
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return (
    <div className="category-bar-chart-tooltip">
      {count === 0
        ? <span>{label}: no rated drinks</span>
        : <><strong>{avgRating}</strong> avg — {label} ({count} rated)</>}
    </div>
  );
}

export default function CategoryBarChart({ data, onBarClick }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="category"
          tickFormatter={c => c.charAt(0).toUpperCase() + c.slice(1)}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis domain={[0, 10]} allowDecimals={false} width={32} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.5 }} />
        <Bar
          dataKey="avgRating"
          barSize={40}
          isAnimationActive={false}
          shape={<BarValue />}
          background={<BarBackground onBarClick={onBarClick} />}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
