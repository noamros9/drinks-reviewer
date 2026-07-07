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
