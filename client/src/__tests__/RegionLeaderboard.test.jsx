import { render, screen } from '@testing-library/react';
import RegionLeaderboard from '../pages/analytics/RegionLeaderboard';

const ROWS = [
  { country: 'Israel', region: 'Galilee', avgRating: 8.2, count: 16 },
  { country: 'Italy', region: 'Chianti', avgRating: 7.5, count: 1 },
];

test('renders one row per region', () => {
  render(<RegionLeaderboard rows={ROWS} />);
  expect(screen.getByText('Galilee')).toBeInTheDocument();
  expect(screen.getByText('Chianti')).toBeInTheDocument();
});

test('shows empty state when there are no rows', () => {
  render(<RegionLeaderboard rows={[]} />);
  expect(screen.getByText('No regions match this filter.')).toBeInTheDocument();
});
