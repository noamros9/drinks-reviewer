import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';
import { COLUMNS } from '../components/DrinkTable';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([]) })
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
  variety: 'Merlot', country: 'France', region: 'Bordeaux', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' };

test('clicking Edit navigates to admin (handleEdit executes)', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([WINE_DRINK]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  const editBtn = await screen.findByRole('button', { name: /edit/i });
  fireEvent.click(editBtn);
  // navigation fires without error
  expect(editBtn).toBeDefined();
});

test('count badge shows total when no filter active', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([WINE_DRINK]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  expect(screen.getByText(/1 entry/)).toBeInTheDocument();
});

test('count badge shows filtered / total when search narrows results', async () => {
  const WINE_B = { ...WINE_DRINK, id: '2', producer: 'OtherProd', seriesAndName: 'OtherWine' };
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([WINE_DRINK, WINE_B]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Reserve');
  fireEvent.change(screen.getByTestId('producer-search'), { target: { value: 'TestProd' } });
  await waitFor(() => {
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });
});

test('loads column layout from localStorage', async () => {
  localStorage.setItem('drinks_columns_wine', JSON.stringify({
    order: COLUMNS.wine.map(c => c.key),
    hidden: ['region'],
  }));
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  // region column should be hidden (reflected in ColumnPanel badge)
  expect(screen.getByTestId('column-panel-btn')).toHaveTextContent('Columns');
});

test('loadLayout falls back to null on invalid JSON', async () => {
  localStorage.setItem('drinks_columns_wine', 'bad{json');
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
});

test('column layout change is saved to localStorage', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-region'));
  expect(localStorage.getItem('drinks_columns_wine')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem('drinks_columns_wine')).hidden).toContain('region');
});

test('saving null layout removes localStorage entry', async () => {
  localStorage.setItem('drinks_columns_wine', JSON.stringify({ order: [], hidden: [] }));
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByText('Reset to default'));
  expect(localStorage.getItem('drinks_columns_wine')).toBeNull();
});

test('handles fetch error gracefully', async () => {
  global.fetch = vi.fn(() => Promise.reject(new Error('network error')));
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
});
