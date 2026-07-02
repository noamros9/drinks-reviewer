import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './TrendLineChart.css';

export function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { month, avgRating, count } = payload[0].payload;
  return (
    <div className="trend-line-tooltip">
      <strong>{avgRating}</strong> avg ({count} {count === 1 ? 'tasting' : 'tastings'}) — {month}
    </div>
  );
}

export default function TrendLineChart({ data }) {
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);
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
        <YAxis domain={[1, 10]} allowDecimals width={32} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--border)' }} />
        <Line
          type="monotone"
          dataKey="avgRating"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--accent)' }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
