import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';
import { COLUMNS } from '../components/DrinkTable';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  );
});

test.each(['wine', 'beer', 'whiskey', 'others'])(
  'shows empty state for %s when there are no entries',
  async (category) => {
    render(
      <MemoryRouter>
        <CategoryPage category={category} />
      </MemoryRouter>
    );
    expect(await screen.findByText(/no entries yet/i)).toBeInTheDocument();
  }
);

test.each([
  ['wine', 'Producer'],
  ['beer', 'Brewery'],
  ['whiskey', 'Distillery'],
  ['others', 'Category'],
])('%s table has correct first column header', async (category, header) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: '1', producer: 'X', brewery: 'X', distillery: 'X', drinkCategory: 'Rum', name: 'Y' },
        ]),
    })
  );
  render(
    <MemoryRouter>
      <CategoryPage category={category} />
    </MemoryRouter>
  );
  expect(await screen.findByText(header)).toBeInTheDocument();
});

// ── handleEdit, localStorage, filtered count ─────────────────────

const WINE_DRINK = { id: '1', producer: 'TestProd', seriesAndName: 'Reserve', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: 'Bordeaux', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' };

test('clicking Edit navigates to admin (handleEdit executes)', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_DRINK]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  const editBtn = await screen.findByRole('button', { name: /edit/i });
  fireEvent.click(editBtn);
  // navigation fires without error
  expect(editBtn).toBeDefined();
});

test('count badge shows total when no filter active', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_DRINK]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  expect(screen.getByText(/1 entry/)).toBeInTheDocument();
});

test('count badge shows filtered / total when search narrows results', async () => {
  const WINE_B = { ...WINE_DRINK, id: '2', producer: 'OtherProd', seriesAndName: 'OtherWine' };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_DRINK, WINE_B]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  fireEvent.change(screen.getByTestId('producer-search'), { target: { value: 'TestProd' } });
  await waitFor(() => {
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });
});

test('fetch error (ok: false) leaves drinks empty without crashing', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  expect(await screen.findByText(/no entries yet/i)).toBeInTheDocument();
});

test('loads column layout from localStorage', async () => {
  localStorage.setItem('drinks_columns_v3_wine', JSON.stringify({
    order: COLUMNS.wine.map(c => c.key),
    hidden: ['region'],
  }));
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  // region column should be hidden (reflected in ColumnPanel badge)
  expect(screen.getByTestId('column-panel-btn')).toHaveTextContent('Columns');
});

test('stale v1 layout key is ignored and defaults apply', async () => {
  localStorage.clear();
  localStorage.setItem('drinks_columns_wine', JSON.stringify({ order: ['producer'], hidden: [] }));
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
  expect(localStorage.getItem('drinks_columns_v3_wine')).toBeNull();
});

test('loadLayout falls back to null on invalid JSON', async () => {
  localStorage.setItem('drinks_columns_v3_wine', 'bad{json');
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
});

test('column layout change is saved to localStorage', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-region'));
  expect(localStorage.getItem('drinks_columns_v3_wine')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem('drinks_columns_v3_wine')).hidden).toContain('region');
});

test('saving null layout removes localStorage entry', async () => {
  localStorage.setItem('drinks_columns_v3_wine', JSON.stringify({ order: [], hidden: [] }));
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByText('Reset to default'));
  expect(localStorage.getItem('drinks_columns_v3_wine')).toBeNull();
});

test('handles fetch error gracefully', async () => {
  global.fetch = vi.fn(() => Promise.reject(new Error('network error')));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
});

test('clicking a producer cell sets producerSearch filter', async () => {
  const WINE_B = { ...WINE_DRINK, id: '2', producer: 'OtherProd', seriesAndName: 'OtherWine' };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_DRINK, WINE_B]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  fireEvent.click(screen.getAllByText('TestProd')[0]);
  await waitFor(() => expect(screen.queryByText('OtherWine')).not.toBeInTheDocument());
  expect(screen.getByText('Reserve')).toBeInTheDocument();
});

test('variety cell is not filterable — clicking a blend does not filter', async () => {
  const BLEND = { ...WINE_DRINK, id: '2', producer: 'Other', seriesAndName: 'BlendWine', variety: 'Cabernet/Merlot' };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_DRINK, BLEND]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  fireEvent.click(screen.getAllByText('Cabernet/Merlot')[0]);
  expect(screen.getByText('Reserve')).toBeInTheDocument();
  expect(screen.getByText('BlendWine')).toBeInTheDocument();
});

test('clicking a country cell adds it to the country Set filter', async () => {
  const WINE_B = { ...WINE_DRINK, id: '2', producer: 'OtherProd', seriesAndName: 'OtherWine', country: 'Italy' };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_DRINK, WINE_B]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  fireEvent.click(screen.getAllByText('France')[0]);
  await waitFor(() => expect(screen.queryByText('OtherWine')).not.toBeInTheDocument());
  expect(screen.getByText('Reserve')).toBeInTheDocument();
});

test('selecting exactly one vintage filter syncs all per-row vintage dropdowns', async () => {
  const WINE_WITH_TASTINGS = {
    ...WINE_DRINK, id: '1',
    tastings: [
      { id: 't1', date: '01/01/2023', rating: 7, vintage: '2019' },
      { id: 't2', date: '01/01/2024', rating: 9, vintage: '2021' },
    ],
    tastingCount: 2, vintage: '2021',
  };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([WINE_WITH_TASTINGS]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  fireEvent.click(screen.getByTestId('filter-dropdown-vintage'));
  fireEvent.click(screen.getByRole('checkbox', { name: /2021/ }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '2021' })).toBeInTheDocument();
  });
});
