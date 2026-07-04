import { render, screen } from '@testing-library/react';
import TrendLineChart from '../components/TrendLineChart';

const DATA = [
  { month: '2025-01', wine: 2, beer: 1, whiskey: 0, others: 3 },
  { month: '2025-02', wine: 1, beer: 2, whiskey: 1, others: 0 },
];
const SERIES = [
  { dataKey: 'wine', color: '#7B2F8B', label: 'Wine' },
  { dataKey: 'beer', color: '#9B6A00', label: 'Beer' },
];

test('single default series (Rating tab usage) renders no legend', () => {
  const { container } = render(<TrendLineChart data={[{ month: '2025-01', avgRating: 8, count: 1 }]} />);
  expect(container.querySelectorAll('.recharts-line')).toHaveLength(1);
  expect(container.querySelector('.recharts-legend-wrapper')).not.toBeInTheDocument();
});

test('multi-series renders a legend with one entry per series', () => {
  const { container } = render(<TrendLineChart data={DATA} series={SERIES} />);
  // one legend item per configured <Line> is the reliable signal here — jsdom's
  // stubbed getBoundingClientRect (see setupTests.js) collapses the actual
  // .recharts-line path geometry to zero-height once a legend is also present,
  // so asserting on line-path elements directly is flaky in this test env.
  expect(container.querySelectorAll('.recharts-legend-item')).toHaveLength(2);
  expect(screen.getByText('Wine')).toBeInTheDocument();
  expect(screen.getByText('Beer')).toBeInTheDocument();
});
