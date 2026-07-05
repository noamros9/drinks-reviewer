import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExplorationSection from '../pages/analytics/ExplorationSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const DRINKS = [
  { id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve', avgRating: 9.5, tastingCount: 1 },
  { id: 'w2', _category: 'wine', producer: 'Winery', seriesAndName: 'Blend', avgRating: 8.8, tastingCount: 9 },
  { id: 'b1', _category: 'beer', brewery: 'Brewery', name: 'Ale', avgRating: 6.0, tastingCount: 1 },
];

function renderSection(globalCategory = 'all') {
  return render(
    <MemoryRouter>
      <ExplorationSection drinks={DRINKS} globalCategory={globalCategory} />
    </MemoryRouter>
  );
}

function scopeFilter() {
  return within(screen.getByTestId('exploration-category-filter'));
}

test('under All scope, ranks drinks by weighted rating rather than raw avgRating', () => {
  renderSection('all');
  // w1 (9.5, 1 tasting) still edges out w2 (8.8, 9 tastings) here, but both outrank b1 (6.0, 1 tasting)
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows[0]).toHaveTextContent('Chateau Reserve');
  expect(rows[1]).toHaveTextContent('Winery Blend');
  expect(rows[2]).toHaveTextContent('Brewery Ale');
});

test('follows the global category when no local override is made', () => {
  renderSection('wine');
  expect(screen.getByText('Chateau Reserve')).toBeInTheDocument();
  expect(screen.queryByText('Brewery Ale')).not.toBeInTheDocument();
});

test('the local scope filter overrides the global category', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('Brewery Ale')).toBeInTheDocument();
  expect(screen.queryByText('Chateau Reserve')).not.toBeInTheDocument();
});

test('shows the empty state when nothing in scope is rated', () => {
  render(
    <MemoryRouter>
      <ExplorationSection drinks={[{ id: 'x', _category: 'wine', avgRating: undefined }]} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.getByText('No rated drinks yet.')).toBeInTheDocument();
});

test('clicking a drink navigates to its Admin tastings tab', () => {
  renderSection('all');
  fireEvent.click(screen.getByText('Chateau Reserve'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});
