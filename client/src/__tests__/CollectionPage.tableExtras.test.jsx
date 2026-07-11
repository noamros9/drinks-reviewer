import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
import CollectionPage from '../pages/CollectionPage';

const LOT = { id: 'lot1', quantity: 2, price: 45, addedAt: '2026-01-01' };
const DRINK = {
  id: 'w1', _category: 'wine', producer: 'Château X', seriesAndName: 'Grand Cru',
  country: 'France', abv: '13', avgRating: '9', collection: [LOT],
};

function mockFetch(collectionData = [DRINK]) {
  global.fetch = vi.fn((url, opts) => {
    if (!opts) return Promise.resolve({ ok: true, json: () => Promise.resolve(collectionData) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(LOT) });
  });
}

beforeEach(() => mockFetch());

test('shows Price column header', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByRole('columnheader', { name: /price/i })).toBeInTheDocument();
});

test('price column shows newest in-stock lot price', async () => {
  const TWO_LOT_DRINK = {
    ...DRINK,
    collection: [
      { id: 'lot-old', quantity: 1, price: 20, addedAt: '2025-01-01' },
      { id: 'lot-new', quantity: 2, price: 30, addedAt: '2026-06-01' },
    ],
  };
  mockFetch([TWO_LOT_DRINK]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByText('30')).toBeInTheDocument();
});

test('price column shows — when there is no in-stock lot', async () => {
  mockFetch([{ ...DRINK, collection: [{ ...LOT, quantity: 0 }] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  const row = screen.getByText('Grand Cru').closest('tr');
  const cells = within(row).getAllByRole('cell');
  expect(cells[5]).toHaveTextContent('—');
});

test('shows Photo column header', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByRole('columnheader', { name: /photo/i })).toBeInTheDocument();
});

test('photo column renders an image when collectionImageUrl is present', async () => {
  mockFetch([{ ...DRINK, collectionImageUrl: 'http://example.com/photo.jpg' }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(document.querySelector('.table-thumb')).toHaveAttribute('src', 'http://example.com/photo.jpg');
});

test('photo column shows — when collectionImageUrl is absent', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(document.querySelector('.table-thumb')).not.toBeInTheDocument();
  const row = screen.getByText('Grand Cru').closest('tr');
  const cells = within(row).getAllByRole('cell');
  expect(cells[6]).toHaveTextContent('—');
});

test('Edit button is rendered per row', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
});

test('Edit navigates to admin with lowercased category and drink state', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { category: 'wine', drink: expect.objectContaining({ id: 'w1' }) },
  });
});
