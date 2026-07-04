import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './TrendLineChart.css';

const DEFAULT_SERIES = [{ dataKey: 'avgRating', color: 'var(--accent)', label: 'Avg rating' }];

export function TrendTooltip({ active, payload, describeTooltip }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (describeTooltip) {
    return <div className="trend-line-tooltip">{describeTooltip(row)}</div>;
  }
  const { month, avgRating, count } = row;
  return (
    <div className="trend-line-tooltip">
      <strong>{avgRating}</strong> avg ({count} {count === 1 ? 'tasting' : 'tastings'}) — {month}
    </div>
  );
}

export default function TrendLineChart({
  data,
  series = DEFAULT_SERIES,
  yDomain = [1, 10],
  yAllowDecimals = true,
  xTickInterval,
  describeTooltip,
}) {
  const tickInterval = xTickInterval ?? Math.max(0, Math.ceil(data.length / 8) - 1);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          interval={tickInterval}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis domain={yDomain} allowDecimals={yAllowDecimals} width={32} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <Tooltip content={<TrendTooltip describeTooltip={describeTooltip} />} cursor={{ stroke: 'var(--border)' }} />
        {series.map(s => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        ))}
        {series.length > 1 && <Legend />}
      </LineChart>
    </ResponsiveContainer>
  );
}
