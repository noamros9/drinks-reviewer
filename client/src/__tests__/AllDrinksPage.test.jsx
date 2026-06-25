import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AllDrinksPage from '../pages/AllDrinksPage';

const WINE_ENTRY    = { id: 'w1', producer: 'Château X', seriesAndName: 'Grand Cru', country: 'France', abv: '13', lastTasted: '01/03/2025', lastRanking: '8.5', avgRanking: '8.2', notionLink: '' };
const BEER_ENTRY    = { id: 'b1', brewery: 'Brew Co',    name: 'Pale Ale',   country: 'UK',     abv: '5',  lastTasted: '15/04/2025', lastRanking: '7',   avgRanking: '7.1', notionLink: '' };
const WHISKEY_ENTRY = { id: 'k1', distillery: 'Glenfid', name: 'Single Malt', country: 'Scotland', abv: '43', lastTasted: '10/01/2025', lastRanking: '9', avgRanking: '9', notionLink: '' };
const OTHERS_ENTRY  = { id: 'o1', distillery: 'Suntory', name: 'Sake',       country: 'Japan',  abv: '15', lastTasted: '20/02/2025', lastRanking: '8',   avgRanking: '8', notionLink: '' };

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? [WINE_ENTRY]
      : url.includes('beer') ? [BEER_ENTRY]
      : url.includes('whiskey') ? [WHISKEY_ENTRY]
      : [OTHERS_ENTRY];
    return Promise.resolve({ json: () => Promise.resolve(data) });
  });
});

test('shows all drinks from all categories', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Grand Cru')).toBeInTheDocument();
  expect(screen.getByText('Pale Ale')).toBeInTheDocument();
  expect(screen.getByText('Single Malt')).toBeInTheDocument();
  expect(screen.getByText('Sake')).toBeInTheDocument();
});

test('shows Category and Producer columns', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByRole('columnheader', { name: /category/i })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /producer/i })).toBeInTheDocument();
});

test('count badge shows total entries', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('4 entries')).toBeInTheDocument();
});

test('filter chips render for all categories', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  ['All', 'Wine', 'Beer', 'Whiskey', 'Others'].forEach(label => {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});

test('filtering to Wine shows only wine entries', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  await waitFor(() => {
    expect(screen.getByText('Grand Cru')).toBeInTheDocument();
    expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  });
});

test('producer column shows brewery for beer', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Brew Co')).toBeInTheDocument();
});

test('does not show Edit button (no onEdit prop)', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

test('country filter narrows visible entries', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  await waitFor(() => {
    expect(screen.getByText('Grand Cru')).toBeInTheDocument();
    expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  });
});

test('loads column layout from localStorage', async () => {
  const { COLUMNS } = await import('../components/DrinkTable');
  localStorage.setItem('drinks_columns_all', JSON.stringify({
    order: COLUMNS.all.map(c => c.key),
    hidden: ['abv'],
  }));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.queryByRole('columnheader', { name: /^abv$/i })).not.toBeInTheDocument();
});

test('loadLayout falls back to null on invalid JSON in localStorage', async () => {
  localStorage.setItem('drinks_columns_all', 'INVALID_JSON');
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  // Should render fine with default layout (no crash)
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
});

test('column layout change is saved to localStorage', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-abv'));
  expect(localStorage.getItem('drinks_columns_all')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem('drinks_columns_all')).hidden).toContain('abv');
});

test('entry with no producer/brewery/distillery shows em-dash in Producer column', async () => {
  const NO_PRODUCER = { id: 'x1', name: 'Mystery Drink', country: 'France', abv: '12',
    lastTasted: '01/01/2025', lastRanking: '7', avgRanking: '7', notionLink: '' };
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? [NO_PRODUCER] : [];
    return Promise.resolve({ json: () => Promise.resolve(data) });
  });
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Mystery Drink')).toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('abv filter onChange lambda updates filter state', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '10' } });
  expect(screen.getByTestId('filter-abv')).toHaveClass('active');
});

test('handles fetch error gracefully (catch branch)', async () => {
  global.fetch = vi.fn(() => Promise.reject(new Error('network error')));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await waitFor(() => {
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });
});

test('resetting columns removes localStorage entry', async () => {
  const ALL_KEYS = ['_category', '_producer', 'name', 'country', 'abv', 'lastTasted', 'lastRanking', 'avgRanking', 'notionLink'];
  localStorage.setItem('drinks_columns_all', JSON.stringify({ order: ALL_KEYS, hidden: ['abv'] }));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByText('Reset to default'));
  expect(localStorage.getItem('drinks_columns_all')).toBeNull();
});
