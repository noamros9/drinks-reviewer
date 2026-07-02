import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RatingSection from '../pages/analytics/RatingSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const DRINKS = [
  { id: 'w1', _category: 'wine', avgRating: 7.5 },
  { id: 'w2', _category: 'wine', avgRating: 4 },
  { id: 'b1', _category: 'beer', avgRating: 9 },
  { id: 'k1', _category: 'whiskey', avgRating: 9.2 },
  { id: 'o1', _category: 'others', avgRating: 4 },
];

function renderSection(globalCategory = 'all') {
  return render(
    <MemoryRouter>
      <RatingSection drinks={DRINKS} globalCategory={globalCategory} />
    </MemoryRouter>
  );
}

function scopeFilter() {
  return within(screen.getByTestId('rating-category-filter'));
}

beforeEach(() => {
  mockNavigate.mockClear();
});

test('defaults to following the global category (All) and shows the total count', () => {
  renderSection('all');
  expect(screen.getByText('5 rated drinks')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'All' })).toHaveClass('active');
});

test('follows a non-All global category when no local override has been made', () => {
  renderSection('wine');
  expect(screen.getByText('2 rated drinks')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'Wine' })).toHaveClass('active');
});

test('clicking the local scope filter overrides the global category', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('1 rated drink')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'Beer' })).toHaveClass('active');
});

test('once overridden, the section stops following changes to the global category', () => {
  const { rerender } = renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('1 rated drink')).toBeInTheDocument();

  rerender(
    <MemoryRouter>
      <RatingSection drinks={DRINKS} globalCategory="whiskey" />
    </MemoryRouter>
  );
  expect(scopeFilter().getByRole('button', { name: 'Beer' })).toHaveClass('active');
  expect(screen.getByText('1 rated drink')).toBeInTheDocument();
});

test('clicking a bar navigates to the scoped category with the bucket range', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Wine' }));
  fireEvent.click(screen.getByTestId('bar-7-8'));
  expect(mockNavigate).toHaveBeenCalledWith('/wine?avgRatingMin=7&avgRatingMax=8');
});

test('clicking a bar while scoped to All navigates to /all', () => {
  renderSection('all');
  fireEvent.click(screen.getByTestId('bar-9-10'));
  expect(mockNavigate).toHaveBeenCalledWith('/all?avgRatingMin=9&avgRatingMax=10');
});

test('shows empty state when there are no rated drinks', () => {
  render(
    <MemoryRouter>
      <RatingSection drinks={[]} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.getByText('No rated drinks yet.')).toBeInTheDocument();
  expect(screen.queryByTestId(/^bar-/)).not.toBeInTheDocument();
});
