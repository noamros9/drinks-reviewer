import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AllDrinksPage from '../pages/AllDrinksPage';

const WINE = { id: 'w1', producer: 'Alpha', seriesAndName: 'Low', country: 'France', abv: '12', lastTasted: '01/01/2020', lastRating: '6', avgRating: 6, tastingCount: 1, notionLink: '' };
const BEER = { id: 'b1', brewery: 'Beta', name: 'High', country: 'UK', abv: '5', lastTasted: '31/12/2025', lastRating: '9', avgRating: 9, tastingCount: 1, notionLink: '' };

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? [WINE] : url.includes('beer') ? [BEER] : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
});

test('sort preset buttons render on All page', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  expect(screen.getByRole('button', { name: 'Top rated' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recently tasted' })).toBeInTheDocument();
});

test('"Top rated" sorts all drinks by avgRating descending', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  fireEvent.click(screen.getByRole('button', { name: 'Top rated' }));
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('High'); // avgRating 9
  expect(rows[2]).toHaveTextContent('Low');  // avgRating 6
});

test('"Recently tasted" sorts all drinks by lastTasted descending', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  fireEvent.click(screen.getByRole('button', { name: 'Recently tasted' }));
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('High'); // 31/12/2025
  expect(rows[2]).toHaveTextContent('Low');  // 01/01/2020
});

test('active preset gets active class on All page', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  const btn = screen.getByRole('button', { name: 'Recently tasted' });
  expect(btn).not.toHaveClass('active');
  fireEvent.click(btn);
  expect(btn).toHaveClass('active');
});

test('clicking column header deactivates active preset on All page', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  const preset = screen.getByRole('button', { name: 'Top rated' });
  fireEvent.click(preset);
  expect(preset).toHaveClass('active');
  fireEvent.click(screen.getByRole('columnheader', { name: /country/i }));
  expect(preset).not.toHaveClass('active');
});

test('clicking same column header twice toggles sort direction on All page', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  const header = screen.getByRole('columnheader', { name: /country/i });
  fireEvent.click(header); // asc
  expect(header).toHaveTextContent('↑');
  fireEvent.click(header); // desc (covers sortKey === key branch)
  expect(header).toHaveTextContent('↓');
  fireEvent.click(header); // asc (covers 'asc' ternary)
  expect(header).toHaveTextContent('↑');
});
