import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const WINE_DRINKS = [
  { id: '1', producer: 'Citra', seriesAndName: 'Bisanzio', wineCategory: 'White', country: 'Italy', region: 'Abruzzo' },
  { id: '2', producer: 'Latroun', seriesAndName: 'Reserve', wineCategory: 'Red', country: 'Israel', region: 'Judean Hills' },
  { id: '3', producer: 'Yatir', seriesAndName: 'Forest', wineCategory: 'Red', country: 'Israel', region: 'Judean Hills' },
  { id: '4', producer: 'Golan', seriesAndName: 'Heights', wineCategory: 'Red', country: 'Israel', region: 'Golan' },
  { id: '5', producer: 'Barkan', seriesAndName: 'Classic', wineCategory: 'White', country: 'Israel', region: 'Shomron' },
  { id: '6', producer: 'Carmel', seriesAndName: 'Appellation', wineCategory: 'Red', country: 'Israel', region: 'Galilee' },
];

function selectRows(ids) {
  for (const id of ids) fireEvent.click(screen.getByLabelText(`Select row ${id}`));
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_DRINKS) }));
  mockNavigate.mockClear();
});

test('no recommend bar when nothing is selected', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  expect(screen.queryByTestId('recommend-bar')).not.toBeInTheDocument();
});

test('selecting a single row already shows the recommend bar', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  selectRows(['1']);
  expect(within(screen.getByTestId('recommend-bar')).getByText('1 entry selected')).toBeInTheDocument();
});

test('selecting a 6th row hides the recommend bar again', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  selectRows(['1', '2', '3', '4', '5', '6']);
  expect(screen.queryByTestId('recommend-bar')).not.toBeInTheDocument();
});

test('clicking Recommend similar navigates to the recommend route', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  selectRows(['1']);
  fireEvent.click(screen.getByText('Recommend similar'));
  expect(mockNavigate).toHaveBeenCalledWith('/recommend?seeds=1:wine');
});
