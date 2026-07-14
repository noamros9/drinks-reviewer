import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';

const DRINKS = [
  { id: '1', producer: 'Alpha', seriesAndName: 'Low', wineCategory: 'Red', variety: ['Merlot'], country: 'France', region: '', abv: '12', lastTasted: '01/01/2020', lastRating: '6', avgRating: 6, tastingCount: 1, notionLink: '' },
  { id: '2', producer: 'Beta',  seriesAndName: 'High', wineCategory: 'White', variety: ['Chardonnay'], country: 'Italy', region: '', abv: '13', lastTasted: '31/12/2025', lastRating: '9', avgRating: 9, tastingCount: 1, notionLink: '' },
];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(DRINKS) }));
});

test('sort preset buttons are rendered', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  expect(screen.getByRole('button', { name: 'Top rated' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recently tasted' })).toBeInTheDocument();
});

test('"Top rated" preset sorts by avgRating descending', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  fireEvent.click(screen.getByRole('button', { name: 'Top rated' }));
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('High'); // avgRating 9 first
  expect(rows[2]).toHaveTextContent('Low');  // avgRating 6 second
});

test('"Recently tasted" preset sorts by lastTasted descending', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  fireEvent.click(screen.getByRole('button', { name: 'Recently tasted' }));
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('High'); // 31/12/2025 most recent
  expect(rows[2]).toHaveTextContent('Low');  // 01/01/2020
});

test('active preset button gets active class', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  const btn = screen.getByRole('button', { name: 'Top rated' });
  expect(btn).not.toHaveClass('active');
  fireEvent.click(btn);
  expect(btn).toHaveClass('active');
});

test('clicking a column header deactivates the preset', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  const preset = screen.getByRole('button', { name: 'Top rated' });
  fireEvent.click(preset);
  expect(preset).toHaveClass('active');
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  expect(preset).not.toHaveClass('active');
});

test('clicking same column header twice toggles sort direction', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  const header = screen.getByRole('columnheader', { name: /producer/i });
  fireEvent.click(header); // asc
  expect(header).toHaveTextContent('↑');
  fireEvent.click(header); // desc (covers sortKey === key branch + 'desc' ternary)
  expect(header).toHaveTextContent('↓');
  fireEvent.click(header); // back to asc (covers 'asc' ternary branch)
  expect(header).toHaveTextContent('↑');
});

