import { render, screen, fireEvent } from '@testing-library/react';
import CategoryBarChart, { CategoryTooltip } from '../components/CategoryBarChart';

const DATA = [
  { category: 'wine', avgRating: 7.2, count: 76 },
  { category: 'beer', avgRating: 8.1, count: 59 },
  { category: 'whiskey', avgRating: 8.9, count: 18 },
  { category: 'others', avgRating: 0, count: 0 },
];

test('renders a bar per category, including a zero-count category, without throwing', () => {
  render(<CategoryBarChart data={DATA} onBarClick={() => {}} />);
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    expect(screen.getByTestId(`bar-${cat}`)).toBeInTheDocument();
  });
});

test('clicking a bar fires onBarClick with the category', () => {
  const onBarClick = vi.fn();
  render(<CategoryBarChart data={DATA} onBarClick={onBarClick} />);
  fireEvent.click(screen.getByTestId('bar-wine'));
  expect(onBarClick).toHaveBeenCalledWith('wine');
});

test('bar is keyboard-activatable', () => {
  const onBarClick = vi.fn();
  render(<CategoryBarChart data={DATA} onBarClick={onBarClick} />);
  fireEvent.keyDown(screen.getByTestId('bar-beer'), { key: 'Enter' });
  expect(onBarClick).toHaveBeenCalledWith('beer');
});

test('tooltip shows "no rated drinks" for a zero-count category', () => {
  render(<CategoryTooltip active payload={[{ payload: { category: 'others', avgRating: 0, count: 0 } }]} />);
  expect(screen.getByText('Others: no rated drinks')).toBeInTheDocument();
});

test('tooltip shows the average and rated count otherwise', () => {
  render(<CategoryTooltip active payload={[{ payload: { category: 'wine', avgRating: 7.2, count: 76 } }]} />);
  expect(screen.getByText('7.2')).toBeInTheDocument();
  expect(screen.getByText(/76 rated/)).toBeInTheDocument();
});

const ABV_DATA = [
  { category: 'wine', avgAbv: 13.1, count: 76 },
  { category: 'beer', avgAbv: 5.4, count: 0 },
];

test('custom dataKey/domain/describe props render ABV-flavored bars and aria-labels', () => {
  render(
    <CategoryBarChart
      data={ABV_DATA} onBarClick={() => {}}
      dataKey="avgAbv" domain={[0, 'dataMax']} emptyLabel="no ABV data"
      describeBar={(label, value) => `${label}: average ABV ${value}%`}
    />
  );
  expect(screen.getByTestId('bar-wine')).toHaveAttribute('aria-label', 'Wine: average ABV 13.1%');
  expect(screen.getByTestId('bar-beer')).toHaveAttribute('aria-label', 'Beer: no ABV data');
});

test('custom describeTooltip prop renders ABV-flavored tooltip text', () => {
  render(
    <CategoryTooltip
      active payload={[{ payload: { category: 'wine', avgAbv: 13.1, count: 76 } }]}
      dataKey="avgAbv"
      describeTooltip={(label, value, count) => <>{value}% avg ABV — {label} ({count} drinks)</>}
    />
  );
  expect(screen.getByText(/13\.1% avg ABV/)).toBeInTheDocument();
});
