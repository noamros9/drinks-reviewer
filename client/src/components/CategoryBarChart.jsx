import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './CategoryBarChart.css';

const defaultDescribeBar = (label, value) => `${label}: average rating ${value}`;
const defaultDescribeTooltip = (label, value, count) => <><strong>{value}</strong> avg — {label} ({count} rated)</>;

function BarBackground({ x, y, width, height, payload, onBarClick, dataKey, emptyLabel, describeBar }) {
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
      aria-label={payload.count === 0 ? `${label}: ${emptyLabel}` : describeBar(label, payload[dataKey])}
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

export function CategoryTooltip({
  active, payload,
  dataKey = 'avgRating',
  emptyLabel = 'no rated drinks',
  describeTooltip = defaultDescribeTooltip,
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const label = row.category.charAt(0).toUpperCase() + row.category.slice(1);
  return (
    <div className="category-bar-chart-tooltip">
      {row.count === 0
        ? <span>{label}: {emptyLabel}</span>
        : describeTooltip(label, row[dataKey], row.count)}
    </div>
  );
}

export default function CategoryBarChart({
  data, onBarClick,
  dataKey = 'avgRating',
  domain = [0, 10],
  emptyLabel = 'no rated drinks',
  describeBar = defaultDescribeBar,
  describeTooltip = defaultDescribeTooltip,
}) {
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
        <YAxis domain={domain} allowDecimals={false} width={32} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <Tooltip content={<CategoryTooltip dataKey={dataKey} emptyLabel={emptyLabel} describeTooltip={describeTooltip} />} cursor={{ fill: 'var(--border)', opacity: 0.5 }} />
        <Bar
          dataKey={dataKey}
          barSize={40}
          isAnimationActive={false}
          shape={<BarValue />}
          background={<BarBackground onBarClick={onBarClick} dataKey={dataKey} emptyLabel={emptyLabel} describeBar={describeBar} />}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
