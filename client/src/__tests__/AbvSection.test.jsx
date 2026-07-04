import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AbvSection from '../pages/analytics/AbvSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const DRINKS = [
  { id: 'w1', _category: 'wine', abv: 13, avgRating: 7.5, producer: 'A', seriesAndName: 'Red' },
  { id: 'w2', _category: 'wine', abv: '12.5', avgRating: 4, producer: 'B', seriesAndName: 'White' },
  { id: 'b1', _category: 'beer', abv: 5, avgRating: 9, brewery: 'C', name: 'Ale' },
  { id: 'k1', _category: 'whiskey', abv: 40, avgRating: 9.2, distillery: 'D', name: 'Malt' },
  { id: 'o1', _category: 'others', abv: 20, avgRating: 4, name: 'Mystery' },
];

function renderSection(globalCategory = 'all') {
  return render(
    <MemoryRouter>
      <AbvSection drinks={DRINKS} globalCategory={globalCategory} />
    </MemoryRouter>
  );
}

function scopeFilter() {
  return within(screen.getByTestId('abv-category-filter'));
}

beforeEach(() => {
  mockNavigate.mockClear();
  vi.spyOn(window, 'open').mockImplementation(() => {});
});

afterEach(() => {
  window.open.mockRestore();
});

test('defaults to following the global category (All) and shows the total count', () => {
  renderSection('all');
  expect(screen.getByText('5 drinks with ABV data')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'All' })).toHaveClass('active');
});

test('follows a non-All global category when no local override has been made', () => {
  renderSection('wine');
  expect(screen.getByText('2 drinks with ABV data')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'Wine' })).toHaveClass('active');
});

test('clicking the local scope filter overrides the global category', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('1 drink with ABV data')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'Beer' })).toHaveClass('active');
});

test('once overridden, the section stops following changes to the global category', () => {
  const { rerender } = renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('1 drink with ABV data')).toBeInTheDocument();

  rerender(
    <MemoryRouter>
      <AbvSection drinks={DRINKS} globalCategory="whiskey" />
    </MemoryRouter>
  );
  expect(scopeFilter().getByRole('button', { name: 'Beer' })).toHaveClass('active');
  expect(screen.getByText('1 drink with ABV data')).toBeInTheDocument();
});

test('a string-typed abv value still counts toward the total', () => {
  renderSection('wine');
  // w1 abv:13 (number), w2 abv:'12.5' (string) -> both counted
  expect(screen.getByText('2 drinks with ABV data')).toBeInTheDocument();
});

test('clicking a histogram bar opens a new tab to the scoped category with the abv range', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  // beer scope has a single entry (abv 5) -> one degenerate bucket {min:5, max:5}
  fireEvent.click(screen.getByTestId('bar-5-5'));
  expect(window.open).toHaveBeenCalledWith('/beer?abvMin=5&abvMax=5', '_blank');
});

test('clicking a category comparison bar opens a new tab to that category with no query string', () => {
  renderSection('all');
  fireEvent.click(screen.getByTestId('bar-beer'));
  expect(window.open).toHaveBeenCalledWith('/beer', '_blank');
});

test('category comparison chart always shows all 4 categories regardless of scope', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Wine' }));
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    expect(screen.getByTestId(`bar-${cat}`)).toBeInTheDocument();
  });
});

test('clicking a scatter point navigates to its Admin tastings tab', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Wine' }));
  fireEvent.click(screen.getByTestId('point-w1'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('shows empty state when there is no ABV data', () => {
  const noAbv = DRINKS.map(({ abv, ...rest }) => rest);
  render(
    <MemoryRouter>
      <AbvSection drinks={noAbv} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.getByText('No ABV data yet.')).toBeInTheDocument();
  expect(screen.queryByTestId(/^bar-/)).not.toBeInTheDocument();
  expect(screen.queryByTestId(/^point-/)).not.toBeInTheDocument();
});
