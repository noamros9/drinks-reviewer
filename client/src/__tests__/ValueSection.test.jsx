import { render, screen, fireEvent, within } from '@testing-library/react';
import ValueSection from '../pages/analytics/ValueSection';

const DRINKS = [
  {
    id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve', avgRating: 9, tastingCount: 5,
    country: 'France', collection: [{ price: 30 }],
  },
  {
    id: 'w2', _category: 'wine', producer: 'Winery', seriesAndName: 'Blend', avgRating: 6, tastingCount: 5,
    country: 'Italy', collection: [{ price: 100 }],
  },
  {
    id: 'b1', _category: 'beer', brewery: 'Brewery', name: 'Ale', avgRating: 8, tastingCount: 5,
    country: 'Israel', collection: [],
  },
];

beforeEach(() => {
  vi.spyOn(window, 'open').mockImplementation(() => {});
});
afterEach(() => {
  window.open.mockRestore();
});

function renderSection(globalCategory = 'all') {
  return render(<ValueSection drinks={DRINKS} globalCategory={globalCategory} />);
}

test('follows the global category', () => {
  renderSection('wine');
  expect(within(screen.getByTestId('best-value-table')).getByText('Chateau Reserve')).toBeInTheDocument();
  expect(screen.queryByText('Brewery Ale')).not.toBeInTheDocument();
});

test('Price vs Rating scatter shows a point per priced drink, click navigates to Admin tastings', () => {
  renderSection('all');
  expect(screen.getByTestId('point-w1')).toBeInTheDocument();
  expect(screen.getByTestId('point-w2')).toBeInTheDocument();
  expect(screen.queryByTestId('point-b1')).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('point-w1'));
  expect(window.open).toHaveBeenCalledWith('/admin?id=w1&category=wine&tab=tastings', '_blank');
});

test('Price vs Rating shows an empty state when nothing in scope has a price', () => {
  render(<ValueSection drinks={[{ id: 'x', _category: 'wine', avgRating: 8 }]} globalCategory="all" />);
  expect(screen.getByText('No price data yet.')).toBeInTheDocument();
});

test('Best Value ranks by weighted rating over price, row link opens Admin tastings in a new tab', () => {
  renderSection('all');
  const table = within(screen.getByTestId('best-value-table'));
  const rows = table.getAllByRole('row').slice(1);
  expect(rows[0]).toHaveTextContent('Chateau Reserve');

  const link = table.getByText('Chateau Reserve').closest('a');
  expect(link).toHaveAttribute('href', '/admin?id=w1&category=wine&tab=tastings');
  expect(link).toHaveAttribute('target', '_blank');
});

test('Best Value shows an empty state when nothing qualifies', () => {
  render(<ValueSection drinks={[{ id: 'x', _category: 'wine', avgRating: 8 }]} globalCategory="all" />);
  expect(screen.getByText('No priced drinks yet.')).toBeInTheDocument();
});

test('Avg Price by Category always covers all categories, ignoring the scope filter', () => {
  renderSection('wine');
  expect(screen.getByTestId('bar-beer')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('bar-beer'));
  expect(window.open).toHaveBeenCalledWith('/beer', '_blank');
});

test('Avg Price by Country lists countries in scope, row click deep-links with the current scope category', () => {
  renderSection('wine');
  const table = within(screen.getByTestId('avg-price-country-table'));
  expect(table.getByText('France')).toBeInTheDocument();
  expect(table.getByText('Italy')).toBeInTheDocument();
  expect(table.queryByText('Israel')).not.toBeInTheDocument();

  fireEvent.click(table.getByText('France'));
  expect(window.open).toHaveBeenCalledWith('/wine?country=France', '_blank');
});

test('prices render in ILS with a trailing symbol, never a dollar sign', () => {
  renderSection('all');
  const table = within(screen.getByTestId('best-value-table'));
  expect(table.getByText('30 ₪')).toBeInTheDocument();
  expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
});

test('Rebuy Candidates lists priced/rated drinks not currently in stock, tagging previously-owned ones', () => {
  const drinks = [
    { id: 'r1', _category: 'wine', producer: 'InStock', avgRating: 8, tastingCount: 5, collection: [{ quantity: 2, price: 40 }] },
    { id: 'r2', _category: 'wine', producer: 'NeverOwned', avgRating: 8, tastingCount: 5, estimatedPrice: 40 },
    { id: 'r3', _category: 'wine', producer: 'DrankItAll', avgRating: 8, tastingCount: 5, collection: [{ quantity: 0, price: 40 }] },
  ];
  render(<ValueSection drinks={drinks} globalCategory="all" />);
  const table = within(screen.getByTestId('rebuy-table'));
  expect(table.queryByText('InStock')).not.toBeInTheDocument();
  expect(table.getByText('NeverOwned')).toBeInTheDocument();
  expect(table.getByText('DrankItAll')).toBeInTheDocument();
  expect(table.getByTitle("You've bought this before")).toBeInTheDocument();

  const link = table.getByText('DrankItAll').closest('a');
  expect(link).toHaveAttribute('href', '/admin?id=r3&category=wine&tab=tastings');
  expect(link).toHaveAttribute('target', '_blank');
});

test('Rebuy Candidates shows an empty state when everything rated is in stock', () => {
  const drinks = [{ id: 'r1', _category: 'wine', producer: 'InStock', avgRating: 8, tastingCount: 5, collection: [{ quantity: 2, price: 40 }] }];
  render(<ValueSection drinks={drinks} globalCategory="all" />);
  expect(screen.getByText('No rebuy candidates — everything rated is still in stock.')).toBeInTheDocument();
});

test('drinks with no price are counted in the footnote under the scatter', () => {
  renderSection('all');
  expect(screen.getByText('1 drink not shown above — no price recorded.')).toBeInTheDocument();
});

test('price bands are hidden on All and show a low-data message for a thinly priced category', () => {
  renderSection('all');
  expect(screen.queryByText('Does Paying More Help?')).not.toBeInTheDocument();

  renderSection('wine');
  expect(screen.getByText('Does Paying More Help?')).toBeInTheDocument();
  expect(screen.getByText('Not enough priced drinks in this category yet.')).toBeInTheDocument();
});

test('Rebuy Candidates section is headed "Worth Restocking"', () => {
  renderSection('all');
  expect(screen.getByText('Worth Restocking')).toBeInTheDocument();
  expect(screen.queryByText('Rebuy Candidates')).not.toBeInTheDocument();
});

test('Best Value table pages past 10 rows instead of truncating the list', () => {
  const wines = Array.from({ length: 15 }, (_, i) => ({
    id: `w${i}`, _category: 'wine', producer: `W${i}`, avgRating: 5 + (i % 5), tastingCount: 5,
    collection: [{ price: (i + 1) * 20 }],
  }));
  render(<ValueSection drinks={wines} globalCategory="wine" />);
  const table = within(screen.getByTestId('best-value-table'));
  expect(table.getAllByRole('row')).toHaveLength(11); // header + 10 rows
  expect(table.getByText('Page 1 of 2')).toBeInTheDocument();

  fireEvent.click(table.getByRole('button', { name: 'Next' }));
  expect(table.getByText('Page 2 of 2')).toBeInTheDocument();
  expect(table.getAllByRole('row')).toHaveLength(6); // header + remaining 5 rows
});

test('Y-axis toggle switches the active mode and the point colour mode', () => {
  renderSection('all');
  const avgBtn = screen.getByRole('button', { name: 'Avg Rating' });
  const valueBtn = screen.getByRole('button', { name: 'Value Score' });
  expect(avgBtn).toHaveClass('active');

  const wineFillBefore = screen.getByTestId('point-w1').style.fill;
  expect(wineFillBefore).toMatch(/--value-diverging-/);
  expect(screen.getByText('Bargains')).toBeInTheDocument(); // quadrant labels shown in rating modes

  fireEvent.click(valueBtn);
  expect(valueBtn).toHaveClass('active');
  expect(avgBtn).not.toHaveClass('active');
  expect(screen.getByTestId('point-w1').style.fill).toMatch(/--value-diverging-/); // color mode is the same in every Y-axis mode
  expect(screen.getByText('Bargains')).toBeInTheDocument(); // quadrant labels shown in Value Score mode too
});

test('point label reflects the selected Y-axis mode, not always Avg Rating', () => {
  renderSection('all');
  expect(screen.getByTestId('point-w1')).toHaveAttribute('aria-label', expect.stringContaining('Avg Rating 9'));

  fireEvent.click(screen.getByRole('button', { name: 'Weighted Rating' }));
  const weightedLabel = screen.getByTestId('point-w1').getAttribute('aria-label');
  expect(weightedLabel).toMatch(/Weighted Rating \d/);
  expect(weightedLabel).not.toContain('Avg Rating');

  fireEvent.click(screen.getByRole('button', { name: 'Value Score' }));
  const valueLabel = screen.getByTestId('point-w1').getAttribute('aria-label');
  expect(valueLabel).toMatch(/Value Score \d/);
  expect(valueLabel).not.toContain('Avg Rating');
});

test('jitter is deterministic for a given id and absent in Value Score mode', () => {
  const drinks = [
    { id: 'w1', _category: 'wine', producer: 'A', avgRating: 8, tastingCount: 5, collection: [{ price: 50 }] },
    { id: 'w2', _category: 'wine', producer: 'B', avgRating: 8, tastingCount: 5, collection: [{ price: 50 }] },
  ];

  const { unmount } = render(<ValueSection drinks={drinks} globalCategory="wine" />);
  const cyFirstRender = screen.getByTestId('point-w1').getAttribute('cy');
  const cyW2RatingMode = screen.getByTestId('point-w2').getAttribute('cy');
  expect(cyFirstRender).not.toBe(cyW2RatingMode); // same rating, different id -> different jitter
  unmount();

  render(<ValueSection drinks={drinks} globalCategory="wine" />);
  expect(screen.getByTestId('point-w1').getAttribute('cy')).toBe(cyFirstRender); // deterministic across renders

  fireEvent.click(screen.getByRole('button', { name: 'Value Score' }));
  // identical price + rating -> tied percentile ranks -> identical valueScore -> no jitter to tell apart
  expect(screen.getByTestId('point-w1').getAttribute('cy')).toBe(screen.getByTestId('point-w2').getAttribute('cy'));
});

test('price bands render as a bar chart once a category has enough priced/rated drinks', () => {
  const wines = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i}`, _category: 'wine', producer: `W${i}`, avgRating: 5 + (i % 5), tastingCount: 5,
    collection: [{ price: (i + 1) * 20 }],
  }));
  render(<ValueSection drinks={wines} globalCategory="wine" />);
  expect(screen.queryByText('Not enough priced drinks in this category yet.')).not.toBeInTheDocument();
  expect(screen.getByTestId('bar-20-60 ₪')).toBeInTheDocument();
});
