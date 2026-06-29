import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => <input data-testid="mock-datepicker" type="text" onChange={() => onChange(null)} />,
}));

const LOT = { id: 'lot1', quantity: 2, price: 30, addedAt: '2026-01-01' };
const EDIT_DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: '', abv: '13',
  lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '',
  collection: [LOT],
};

function renderEditPage(drink = EDIT_DRINK) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink } }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'lot2', quantity: 3, price: null, addedAt: '2026-06-28' }) })
  );
});

test('shows My Collection section in edit mode', () => {
  renderEditPage();
  expect(screen.getByText(/my collection/i)).toBeInTheDocument();
});

test('shows existing lot quantity', () => {
  renderEditPage();
  expect(screen.getByText('Qty: 2')).toBeInTheDocument();
});

test('shows existing lot price', () => {
  renderEditPage();
  expect(screen.getByText('Price: 30')).toBeInTheDocument();
});

test('shows no bottles message when collection is empty', () => {
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  expect(screen.getByText(/no bottles in collection/i)).toBeInTheDocument();
});

test('collection section is hidden in create mode', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect(screen.queryByText(/my collection/i)).not.toBeInTheDocument();
});

test('add lot calls POST to collection endpoint', async () => {
  renderEditPage();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

test('add lot with custom quantity sends correct body', async () => {
  renderEditPage();
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"quantity":5'),
      })
    );
  });
});

test('add lot shows success message', async () => {
  renderEditPage();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(await screen.findByText('Lot added!')).toBeInTheDocument();
});

test('remove lot calls DELETE to collection endpoint', async () => {
  renderEditPage();
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection/lot1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

test('remove lot hides it from the list', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  renderEditPage();
  expect(screen.getByText('Qty: 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => {
    expect(screen.queryByText('Qty: 2')).not.toBeInTheDocument();
  });
});

test('add lot failure shows error message', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(await screen.findByText('Failed to add lot.')).toBeInTheDocument();
});

test('remove lot failure shows error message', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  renderEditPage();
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  expect(await screen.findByText('Failed to remove lot.')).toBeInTheDocument();
});

test('add lot with qty 0 does not call fetch', () => {
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(global.fetch).not.toHaveBeenCalled();
});

test('add lot with price sends price in request body', async () => {
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText(/^price$/i), { target: { value: '45.50' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"price":45.5'),
      })
    );
  });
});
