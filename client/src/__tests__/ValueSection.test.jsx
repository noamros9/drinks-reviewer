import { render, screen, fireEvent, within } from '@testing-library/react';
import ValueSection from '../pages/analytics/ValueSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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
  mockNavigate.mockClear();
});
afterEach(() => {
  window.open.mockRestore();
});

function renderSection(globalCategory = 'all') {
  return render(<ValueSection drinks={DRINKS} globalCategory={globalCategory} />);
}

function scopeFilter() {
  return within(screen.getByTestId('value-category-filter'));
}

test('follows the global category and the local scope filter overrides it', () => {
  renderSection('wine');
  expect(within(screen.getByTestId('best-value-table')).getByText('Chateau Reserve')).toBeInTheDocument();
  expect(screen.queryByText('Brewery Ale')).not.toBeInTheDocument();

  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.queryByText('Chateau Reserve')).not.toBeInTheDocument();
});

test('Price vs Rating scatter shows a point per priced drink, click navigates to Admin tastings', () => {
  renderSection('all');
  expect(screen.getByTestId('point-w1')).toBeInTheDocument();
  expect(screen.getByTestId('point-w2')).toBeInTheDocument();
  expect(screen.queryByTestId('point-b1')).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('point-w1'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('Price vs Rating shows an empty state when nothing in scope has a price', () => {
  render(<ValueSection drinks={[{ id: 'x', _category: 'wine', avgRating: 8 }]} globalCategory="all" />);
  expect(screen.getByText('No price data yet.')).toBeInTheDocument();
});

test('Best Value ranks by weighted rating over price, row click navigates', () => {
  renderSection('all');
  const table = within(screen.getByTestId('best-value-table'));
  const rows = table.getAllByRole('row').slice(1);
  expect(rows[0]).toHaveTextContent('Chateau Reserve');

  fireEvent.click(table.getByText('Chateau Reserve'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
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

  fireEvent.click(table.getByText('DrankItAll'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { drink: drinks[2], category: 'wine', tab: 'tastings' } });
});

test('Rebuy Candidates shows an empty state when everything rated is in stock', () => {
  const drinks = [{ id: 'r1', _category: 'wine', producer: 'InStock', avgRating: 8, tastingCount: 5, collection: [{ quantity: 2, price: 40 }] }];
  render(<ValueSection drinks={drinks} globalCategory="all" />);
  expect(screen.getByText('No rebuy candidates — everything rated is still in stock.')).toBeInTheDocument();
});

test('spend summary is hidden with nothing in stock, appears once a priced lot has quantity', () => {
  const { rerender } = render(<ValueSection drinks={DRINKS} globalCategory="all" />);
  expect(screen.queryByTestId('spend-summary')).not.toBeInTheDocument();

  const withStock = [...DRINKS, {
    id: 's1', _category: 'wine', producer: 'Stocked', avgRating: 7, tastingCount: 5, collection: [{ quantity: 2, price: 50 }],
  }];
  rerender(<ValueSection drinks={withStock} globalCategory="all" />);
  expect(within(screen.getByTestId('spend-summary')).getByText('100 ₪')).toBeInTheDocument();
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

test('price bands render as a bar chart once a category has enough priced/rated drinks', () => {
  const wines = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i}`, _category: 'wine', producer: `W${i}`, avgRating: 5 + (i % 5), tastingCount: 5,
    collection: [{ price: (i + 1) * 20 }],
  }));
  render(<ValueSection drinks={wines} globalCategory="wine" />);
  expect(screen.queryByText('Not enough priced drinks in this category yet.')).not.toBeInTheDocument();
  expect(screen.getByTestId('bar-20-60 ₪')).toBeInTheDocument();
});
