import { render, screen } from '@testing-library/react';
import { TrendTooltip } from '../components/TrendLineChart';

test('renders nothing when inactive', () => {
  const { container } = render(<TrendTooltip active={false} payload={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders nothing when payload is empty', () => {
  const { container } = render(<TrendTooltip active payload={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('shows avg rating, tasting count, and month', () => {
  render(<TrendTooltip active payload={[{ payload: { month: '2025-03', avgRating: 7.5, count: 3 } }]} />);
  expect(screen.getByText('7.5')).toBeInTheDocument();
  expect(screen.getByText(/3 tastings/)).toBeInTheDocument();
  expect(screen.getByText(/2025-03/)).toBeInTheDocument();
});

test('singular "tasting" for a count of 1', () => {
  render(<TrendTooltip active payload={[{ payload: { month: '2025-03', avgRating: 8, count: 1 } }]} />);
  expect(screen.getByText(/1 tasting\)/)).toBeInTheDocument();
});

test('describeTooltip overrides the legacy avgRating rendering', () => {
  render(
    <TrendTooltip
      active payload={[{ payload: { month: '2025-04', count: 5 } }]}
      describeTooltip={row => <span>{row.count} new drinks</span>}
    />
  );
  expect(screen.getByText('5 new drinks')).toBeInTheDocument();
});

test('describeTooltip receives the full row, including multi-series keys', () => {
  const row = { month: '2025-04', wine: 2, beer: 1, whiskey: 0, others: 3 };
  render(
    <TrendTooltip
      active payload={[{ payload: row }]}
      describeTooltip={r => <span>wine {r.wine} beer {r.beer}</span>}
    />
  );
  expect(screen.getByText('wine 2 beer 1')).toBeInTheDocument();
});
