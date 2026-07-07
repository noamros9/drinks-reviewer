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
];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_DRINKS) }));
  mockNavigate.mockClear();
});

test('no compare bar when 0 or 1 rows are selected', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  expect(screen.queryByTestId('compare-bar')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Select row 1'));
  expect(screen.queryByTestId('compare-bar')).not.toBeInTheDocument();
});

test('selecting exactly 2 rows shows the compare bar alongside the bulk edit bar', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  fireEvent.click(screen.getByLabelText('Select row 2'));
  expect(screen.getByTestId('compare-bar')).toBeInTheDocument();
  expect(screen.getByTestId('bulk-edit-bar')).toBeInTheDocument();
});

test('selecting a 3rd row hides the compare bar again', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  fireEvent.click(screen.getByLabelText('Select row 2'));
  fireEvent.click(screen.getByLabelText('Select row 3'));
  expect(screen.queryByTestId('compare-bar')).not.toBeInTheDocument();
});

test('clicking Compare navigates to the compare route with both selected ids', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  fireEvent.click(screen.getByLabelText('Select row 2'));
  fireEvent.click(screen.getByTestId('compare-bar').querySelector('button'));
  expect(mockNavigate).toHaveBeenCalledWith('/compare?category=wine&a=1&b=2');
});
