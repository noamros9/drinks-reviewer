import { render, screen, fireEvent } from '@testing-library/react';
import ConsistencyLeaderboard from '../pages/analytics/ConsistencyLeaderboard';

const STEADY = { id: '1', label: 'A Steady', category: 'wine', stdDev: 0, tastingCount: 2, drink: { id: '1', name: 'Steady' } };
const WILD = { id: '2', label: 'B Wild', category: 'beer', stdDev: 3, tastingCount: 2, drink: { id: '2', name: 'Wild' } };

test('renders both lists with their entries', () => {
  render(<ConsistencyLeaderboard mostConsistent={[STEADY]} leastConsistent={[WILD]} onSelectDrink={() => {}} />);
  expect(screen.getByText('Most Consistent')).toBeInTheDocument();
  expect(screen.getByText('Least Consistent')).toBeInTheDocument();
  expect(screen.getByText('A Steady')).toBeInTheDocument();
  expect(screen.getByText('0.00')).toBeInTheDocument();
  expect(screen.getByText('B Wild')).toBeInTheDocument();
  expect(screen.getByText('3.00')).toBeInTheDocument();
});

test('shows an empty-pool message when there are no qualifying drinks', () => {
  render(<ConsistencyLeaderboard mostConsistent={[]} leastConsistent={[]} onSelectDrink={() => {}} />);
  expect(screen.getAllByText('No drinks with more than one tasting yet.')).toHaveLength(2);
});

test('clicking a drink name fires onSelectDrink with that entry', () => {
  const onSelectDrink = vi.fn();
  render(<ConsistencyLeaderboard mostConsistent={[STEADY]} leastConsistent={[WILD]} onSelectDrink={onSelectDrink} />);
  fireEvent.click(screen.getByText('A Steady'));
  expect(onSelectDrink).toHaveBeenCalledWith(STEADY);
});
