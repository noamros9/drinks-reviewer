import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComparePage from '../pages/ComparePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const DRINKS = [
  {
    id: '1', producer: 'Citra', seriesAndName: 'Bisanzio', wineCategory: 'White', variety: 'Trebbiano',
    sweetness: 'Dry', country: 'Italy', region: 'Abruzzo', abv: 12.5, vivinoScore: 4.2, tags: ['crisp', 'citrus'],
    avgRating: 4.5, tastingCount: 3, collection: [{ price: 20 }, { price: 30 }],
    tastings: [
      { date: '2024-01-01', rating: 4, vintage: '2020' },
      { date: '2024-02-01', rating: 5, vintage: '2021' },
      { date: '2024-03-01', rating: 4.5, vintage: '2019' },
    ],
  },
  {
    id: '2', producer: 'Latroun', seriesAndName: 'Reserve', wineCategory: 'Red', variety: '',
    sweetness: 'Dry', country: 'Israel', region: 'Judean Hills', abv: 14, vivinoScore: '', tags: [],
    avgRating: 4.0, tastingCount: 1, collection: [{ price: 10 }],
    tastings: [{ date: '2024-01-15', rating: 4, vintage: '2018' }],
  },
];

function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><ComparePage /></MemoryRouter>);
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(DRINKS) }));
  mockNavigate.mockClear();
});

test('renders both drinks\' field values side by side', async () => {
  renderAt('/compare?category=wine&a=1&b=2');
  const fieldsTable = await screen.findByTestId('compare-fields-table');
  expect(within(fieldsTable).getByText('Citra Bisanzio')).toBeInTheDocument();
  expect(within(fieldsTable).getByText('Latroun Reserve')).toBeInTheDocument();
  expect(within(fieldsTable).getByText('Trebbiano')).toBeInTheDocument();
  expect(within(fieldsTable).getByText('crisp, citrus')).toBeInTheDocument();

  const varietyRow = screen.getByText('Variety').closest('tr');
  expect(within(varietyRow).getByText('—')).toBeInTheDocument();
});

test('shows weighted rating, avg lot price, and tasting count for each drink', async () => {
  renderAt('/compare?category=wine&a=1&b=2');
  await screen.findByTestId('compare-fields-table');

  const weightedRow = screen.getByText('Weighted Rating').closest('tr');
  expect(within(weightedRow).getByText('4.4')).toBeInTheDocument();
  expect(within(weightedRow).getByText('4.17')).toBeInTheDocument();

  const priceRow = screen.getByText('Avg Lot Price').closest('tr');
  expect(within(priceRow).getByText('25')).toBeInTheDocument();
  expect(within(priceRow).getByText('10')).toBeInTheDocument();

  const tastingsRow = screen.getByText('Tastings').closest('tr');
  expect(within(tastingsRow).getByText('3')).toBeInTheDocument();
  expect(within(tastingsRow).getByText('1')).toBeInTheDocument();
});

test('shows tasting history rows for both drinks, blank where one has fewer', async () => {
  renderAt('/compare?category=wine&a=1&b=2');
  const historyTable = await screen.findByTestId('compare-history-table');

  expect(within(historyTable).getByText('2024-01-01 — 4 (2020)')).toBeInTheDocument();
  expect(within(historyTable).getByText('2024-01-15 — 4 (2018)')).toBeInTheDocument();
  expect(within(historyTable).getByText('2024-02-01 — 5 (2021)')).toBeInTheDocument();
  expect(within(historyTable).getByText('2024-03-01 — 4.5 (2019)')).toBeInTheDocument();

  const row2 = within(historyTable).getByText('#2').closest('tr');
  expect(within(row2).getByText('—')).toBeInTheDocument();
});

test('shows a not-found state when a/b params are missing', async () => {
  renderAt('/compare?category=wine');
  expect(await screen.findByText(/Couldn.t find both drinks/)).toBeInTheDocument();
});

test('shows a not-found state when an id is absent from the fetched list', async () => {
  renderAt('/compare?category=wine&a=999&b=2');
  expect(await screen.findByText(/Couldn.t find both drinks/)).toBeInTheDocument();
});

test('shows an unknown-category state and skips fetching when category is invalid', () => {
  renderAt('/compare?category=nope&a=1&b=2');
  expect(screen.getByText(/Unknown category/)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('Back button navigates to the category page', async () => {
  renderAt('/compare?category=wine&a=1&b=2');
  await screen.findByTestId('compare-fields-table');
  fireEvent.click(screen.getByText('← Back to Wine'));
  expect(mockNavigate).toHaveBeenCalledWith('/wine');
});
