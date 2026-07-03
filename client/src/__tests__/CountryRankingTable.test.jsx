import { render, screen, fireEvent } from '@testing-library/react';
import CountryRankingTable from '../pages/analytics/CountryRankingTable';

const ROWS = [
  { country: 'Italy', avgRating: 7.2, count: 76 },
  { country: 'France', avgRating: 8.1, count: 10 },
];

test('renders one row per country', () => {
  render(<CountryRankingTable rows={ROWS} onSelectCountry={() => {}} />);
  expect(screen.getByText('Italy')).toBeInTheDocument();
  expect(screen.getByText('France')).toBeInTheDocument();
});

test('shows empty state when there are no rows', () => {
  render(<CountryRankingTable rows={[]} onSelectCountry={() => {}} />);
  expect(screen.getByText('No country data yet.')).toBeInTheDocument();
});

test('clicking a header cycles ascending, then descending, then back to ascending', () => {
  render(<CountryRankingTable rows={ROWS} onSelectCountry={() => {}} />);
  const rowsText = () => screen.getAllByRole('row').slice(1).map(r => r.textContent);

  fireEvent.click(screen.getByText(/^Country/));
  expect(rowsText()[0]).toMatch(/^France/);

  fireEvent.click(screen.getByText(/^Country/));
  expect(rowsText()[0]).toMatch(/^Italy/);

  fireEvent.click(screen.getByText(/^Country/));
  expect(rowsText()[0]).toMatch(/^France/);
});

test('rows with equal values on the sorted column keep their relative order', () => {
  const tiedRows = [
    { country: 'Italy', avgRating: 8, count: 5 },
    { country: 'France', avgRating: 8, count: 3 },
  ];
  render(<CountryRankingTable rows={tiedRows} onSelectCountry={() => {}} />);
  fireEvent.click(screen.getByText(/^Avg Rating/));
  const rowsText = screen.getAllByRole('row').slice(1).map(r => r.textContent);
  expect(rowsText[0]).toMatch(/^Italy/);
  expect(rowsText[1]).toMatch(/^France/);
});

test('clicking a row fires onSelectCountry with that row\'s country', () => {
  const onSelectCountry = vi.fn();
  render(<CountryRankingTable rows={ROWS} onSelectCountry={onSelectCountry} />);
  fireEvent.click(screen.getByText('Italy'));
  expect(onSelectCountry).toHaveBeenCalledWith('Italy');
});
