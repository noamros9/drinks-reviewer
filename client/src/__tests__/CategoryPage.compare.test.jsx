import { render, screen, fireEvent } from '@testing-library/react';
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

test('no compare bar when 0 or 1 rows are selected', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  expect(screen.queryByTestId('compare-bar')).not.toBeInTheDocument();
  selectRows(['1']);
  expect(screen.queryByTestId('compare-bar')).not.toBeInTheDocument();
});

test('selecting between 2 and 5 rows shows the compare bar alongside the bulk edit bar', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  selectRows(['1', '2']);
  expect(screen.getByTestId('compare-bar')).toBeInTheDocument();
  expect(screen.getByTestId('bulk-edit-bar')).toBeInTheDocument();

  selectRows(['3', '4', '5']);
  expect(screen.getByTestId('compare-bar')).toBeInTheDocument();
  expect(screen.getByText('Compare 5')).toBeInTheDocument();
});

test('selecting a 6th row hides the compare bar again', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  selectRows(['1', '2', '3', '4', '5', '6']);
  expect(screen.queryByTestId('compare-bar')).not.toBeInTheDocument();
});

test('clicking Compare navigates to the compare route with all selected ids', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  selectRows(['1', '2', '3']);
  fireEvent.click(screen.getByText('Compare 3'));
  expect(mockNavigate).toHaveBeenCalledWith('/compare?category=wine&ids=1,2,3');
});
