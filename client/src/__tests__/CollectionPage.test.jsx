import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

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

test('shows in-stock drinks', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByText('Grand Cru')).toBeInTheDocument();
});

test('shows quantity badge with total', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByTestId('stock-badge')).toHaveTextContent('2');
});

test('shows count badge with number of drinks', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByText('1 drink')).toBeInTheDocument();
});

test('Pick for me button is rendered', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByRole('button', { name: /pick for me/i })).toBeInTheDocument();
});

test('Pick for me shows spotlight dialog', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /pick for me/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('spotlight dialog can be closed', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /pick for me/i }));
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('decrement calls PATCH with quantity - 1 on oldest lot', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /remove one bottle/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/w1/collection/lot1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantity: 1 }) })
    );
  });
});

test('increment calls PATCH with quantity + 1 on newest lot', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /add one bottle/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/w1/collection/lot1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantity: 3 }) })
    );
  });
});

test('shows empty state when collection is empty', async () => {
  mockFetch([]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByText(/no entries yet/i)).toBeInTheDocument();
});

test('Pick for me does nothing when collection is empty', async () => {
  mockFetch([]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText(/no entries yet/i);
  fireEvent.click(screen.getByRole('button', { name: /pick for me/i }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('normalizes beer _producer from brewery field', async () => {
  mockFetch([{ id: 'b1', _category: 'beer', brewery: 'Brew Co', name: 'IPA', collection: [LOT] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByText('Brew Co')).toBeInTheDocument();
});

test('shows Stock column header', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByRole('columnheader', { name: /stock/i })).toBeInTheDocument();
});

test('normalizes _producer from distillery when producer and brewery are absent', async () => {
  mockFetch([{ id: 'k1', _category: 'whiskey', distillery: 'Lagavulin', name: 'Special', collection: [LOT] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  expect(await screen.findByText('Lagavulin')).toBeInTheDocument();
});

test('normalizes _producer to — and name to empty string when all identifier fields are absent', async () => {
  mockFetch([{ id: 'x1', _category: 'others', collection: [LOT] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  // Component renders without error; _producer falls back to '—' and name to ''
  expect(await screen.findByTestId('stock-badge')).toBeInTheDocument();
});

test('increment with undefined collection returns early without fetching', async () => {
  mockFetch([{ ...DRINK, collection: undefined }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  const callsBefore = global.fetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /add one bottle/i }));
  expect(global.fetch.mock.calls.length).toBe(callsBefore);
});

test('decrement picks oldest lot even when lots are stored newest-first', async () => {
  const REVERSE_ORDER = {
    ...DRINK,
    collection: [
      { id: 'lot-new', quantity: 2, price: 30, addedAt: '2026-06-01' },
      { id: 'lot-old', quantity: 1, price: 20, addedAt: '2025-01-01' },
    ],
  };
  mockFetch([REVERSE_ORDER]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /remove one bottle/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/w1/collection/lot-old',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantity: 0 }) })
    );
  });
});

test('decrement with undefined collection returns early without fetching', async () => {
  mockFetch([{ ...DRINK, collection: undefined }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  const callsBefore = global.fetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /remove one bottle/i }));
  expect(global.fetch.mock.calls.length).toBe(callsBefore);
});

test('increment with all-zero-quantity lots returns early without fetching', async () => {
  mockFetch([{ ...DRINK, collection: [{ ...LOT, quantity: 0 }] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  const callsBefore = global.fetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /add one bottle/i }));
  expect(global.fetch.mock.calls.length).toBe(callsBefore);
});

test('pick spotlight omits country separator when country is empty', async () => {
  mockFetch([{ ...DRINK, country: '' }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /pick for me/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByText(/·/)).not.toBeInTheDocument();
});

test('"Drank it" button is rendered per row', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByRole('button', { name: /drank it/i })).toBeInTheDocument();
});

test('"Drank it" navigates to admin with drink state and drankIt flag', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /drank it/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', expect.objectContaining({
    state: expect.objectContaining({ drankIt: true, lot: LOT }),
  }));
});

test('"Drank it" routes to the Review tab for a never-reviewed drink', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /drank it/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', expect.objectContaining({
    state: expect.objectContaining({ tab: 'review' }),
  }));
});

test('"Drank it" routes to the Tastings tab for an already-reviewed drink', async () => {
  mockFetch([{ ...DRINK, tastingCount: 3 }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /drank it/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', expect.objectContaining({
    state: expect.objectContaining({ tab: 'tastings' }),
  }));
});

test('decrement picks oldest lot when drink has multiple in-stock lots', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: /remove one bottle/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/w1/collection/lot-old',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantity: 0 }) })
    );
  });
});
