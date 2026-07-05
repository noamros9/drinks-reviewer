import { render, screen, fireEvent } from '@testing-library/react';
import StyleLeaderboardTable from '../pages/analytics/StyleLeaderboardTable';

const ROWS = [
  { style: 'IPA', avgRating: 8.5, weightedRating: 8.3, count: 9 },
  { style: 'Stout', avgRating: 7.2, weightedRating: 7.5, count: 4 },
];

test('renders one row per style with the given first-column label', () => {
  render(<StyleLeaderboardTable rows={ROWS} label="Style" onSelectStyle={() => {}} />);
  expect(screen.getByText(/^Style/)).toBeInTheDocument();
  expect(screen.getByText('IPA')).toBeInTheDocument();
  expect(screen.getByText('Stout')).toBeInTheDocument();
});

test('shows an empty state naming the label when there are no rows', () => {
  render(<StyleLeaderboardTable rows={[]} label="Variety" onSelectStyle={() => {}} />);
  expect(screen.getByText('No variety data yet.')).toBeInTheDocument();
});

test('clicking a header cycles ascending, descending, then back to ascending', () => {
  render(<StyleLeaderboardTable rows={ROWS} label="Style" onSelectStyle={() => {}} />);
  const rowsText = () => screen.getAllByRole('row').slice(1).map(r => r.textContent);

  fireEvent.click(screen.getByText(/^Count/));
  expect(rowsText()[0]).toMatch(/^Stout/);

  fireEvent.click(screen.getByText(/^Count/));
  expect(rowsText()[0]).toMatch(/^IPA/);

  fireEvent.click(screen.getByText(/^Count/));
  expect(rowsText()[0]).toMatch(/^Stout/);
});

test('sorts by the weighted rating column', () => {
  render(<StyleLeaderboardTable rows={ROWS} label="Style" onSelectStyle={() => {}} />);
  fireEvent.click(screen.getByText(/^Weighted Rating/));
  const rowsText = screen.getAllByRole('row').slice(1).map(r => r.textContent);
  expect(rowsText[0]).toMatch(/^Stout/); // ascending: 7.5 (Stout) before 8.3 (IPA)
});

test('clicking a row fires onSelectStyle with that row\'s style', () => {
  const onSelectStyle = vi.fn();
  render(<StyleLeaderboardTable rows={ROWS} label="Style" onSelectStyle={onSelectStyle} />);
  fireEvent.click(screen.getByText('IPA'));
  expect(onSelectStyle).toHaveBeenCalledWith('IPA');
});

test('rows are not clickable when onSelectStyle is omitted (blend/display-only mode)', () => {
  render(<StyleLeaderboardTable rows={ROWS} label="Variety" />);
  const dataRow = screen.getAllByRole('row')[1];
  expect(dataRow).not.toHaveClass('country-ranking-row');
  // clicking is a no-op; nothing to assert beyond it not throwing
  fireEvent.click(screen.getByText('IPA'));
});
