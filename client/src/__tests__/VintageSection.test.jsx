import { render, screen, fireEvent, within } from '@testing-library/react';
import VintageSection from '../pages/analytics/VintageSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const DRINKS = [
  {
    id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve',
    tastings: [
      { id: 't1', vintage: '2020', rating: 8, date: '01/06/2025' },
      { id: 't2', vintage: '2021', rating: 9, date: '01/06/2025' },
    ],
  },
  { id: 'b1', _category: 'beer', tastings: [{ id: 't3', vintage: '2020', rating: 9, date: '01/06/2025' }] },
];

beforeEach(() => {
  vi.spyOn(window, 'open').mockImplementation(() => {});
  mockNavigate.mockClear();
});
afterEach(() => {
  window.open.mockRestore();
});

test('renders no scope tabs, just a wine-only note', () => {
  render(<VintageSection drinks={DRINKS} globalCategory="all" />);
  expect(screen.getByText('(wine only)')).toBeInTheDocument();
  expect(screen.queryByTestId('vintage-category-filter')).not.toBeInTheDocument();
});

test('excludes non-wine drinks from the leaderboard and scatter', () => {
  render(<VintageSection drinks={DRINKS} globalCategory="all" />);
  const table = within(screen.getByTestId('style-leaderboard-table'));
  expect(table.getByText('2020')).toBeInTheDocument();
  expect(table.getByText('2021')).toBeInTheDocument();
  // the beer drink's 2020/rating-9 tasting must not be pooled into wine's 2020 row
  const row2020 = table.getByText('2020').closest('tr');
  const cells = within(row2020).getAllByRole('cell').map(c => c.textContent);
  expect(cells).toEqual(['2020', '8', '8.25', '1']); // avgRating 8, count 1 — not avg 8.5/count 2
});

test('leaderboard row click deep-links to the filtered wine page by vintage', () => {
  render(<VintageSection drinks={DRINKS} globalCategory="all" />);
  fireEvent.click(within(screen.getByTestId('style-leaderboard-table')).getByText('2020'));
  expect(window.open).toHaveBeenCalledWith('/wine?vintage=2020', '_blank');
});

test('scatter point click navigates to the drink\'s Admin tastings tab', () => {
  render(<VintageSection drinks={DRINKS} globalCategory="all" />);
  fireEvent.click(screen.getByTestId('point-t1'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('a multi-vintage drink yields multiple scatter points', () => {
  render(<VintageSection drinks={DRINKS} globalCategory="all" />);
  expect(screen.getByTestId('point-t1')).toBeInTheDocument();
  expect(screen.getByTestId('point-t2')).toBeInTheDocument();
});

test('shows empty states when there is no wine vintage data', () => {
  render(<VintageSection drinks={[{ id: 'b1', _category: 'beer', tastings: [] }]} globalCategory="all" />);
  expect(screen.getByText('No vintage data yet.')).toBeInTheDocument();
  expect(screen.getByText('No age data yet.')).toBeInTheDocument();
});
