import { render, screen, fireEvent } from '@testing-library/react';
import BestOfLeaderboard from '../pages/analytics/BestOfLeaderboard';

const ROWS = [
  { id: 'w1', label: 'Chateau Reserve', category: 'wine', avgRating: 8.8, weightedRating: 8.73, tastingCount: 9 },
  { id: 'b1', label: 'Brewery Ale', category: 'beer', avgRating: 6, weightedRating: 7.05, tastingCount: 1 },
];

test('renders one row per drink with category, avg and weighted rating', () => {
  render(<BestOfLeaderboard rows={ROWS} onSelectDrink={() => {}} />);
  expect(screen.getByText('Chateau Reserve')).toBeInTheDocument();
  expect(screen.getByText('Brewery Ale')).toBeInTheDocument();
  expect(screen.getByText('Wine')).toBeInTheDocument();
  expect(screen.getByText('Beer')).toBeInTheDocument();
  expect(screen.getByText('8.73')).toBeInTheDocument();
});

test('shows empty state when there are no rows', () => {
  render(<BestOfLeaderboard rows={[]} onSelectDrink={() => {}} />);
  expect(screen.getByText('No rated drinks yet.')).toBeInTheDocument();
});

test('clicking a drink link fires onSelectDrink with that row', () => {
  const onSelectDrink = vi.fn();
  render(<BestOfLeaderboard rows={ROWS} onSelectDrink={onSelectDrink} />);
  fireEvent.click(screen.getByText('Chateau Reserve'));
  expect(onSelectDrink).toHaveBeenCalledWith(ROWS[0]);
});
