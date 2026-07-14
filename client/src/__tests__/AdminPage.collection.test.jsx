import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => <input data-testid="mock-datepicker" type="text" onChange={() => onChange(null)} />,
}));

const LOT = { id: 'lot1', quantity: 2, price: 30, addedAt: '2026-01-01' };
const EDIT_DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: ['Merlot'], country: 'France', region: '', abv: '13',
  lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '',
  collection: [LOT],
};

function renderEditPage(drink = EDIT_DRINK) {
  const result = render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  return result;
}

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'lot2', quantity: 3, price: null, addedAt: '2026-06-28' }) })
  );
});

test('shows Review and Collection tabs in edit mode', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('button', { name: /^review$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^collection$/i })).toBeInTheDocument();
});

test('switching back to Review tab shows the form', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^review$/i }));
  expect(screen.getByLabelText(/producer/i)).toBeInTheDocument();
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

test('tabs are visible in create mode', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect(screen.getByRole('button', { name: /^review$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^collection$/i })).toBeInTheDocument();
});

test('collection tab in create mode shows the add-to-collection form', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  expect(screen.getByLabelText(/^producer$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^quantity$/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add to collection/i })).toBeInTheDocument();
});

test('deep link with category and tab: collection lands on Collection tab with that category preselected', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'beer', tab: 'collection' } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('button', { name: /^collection$/i })).toHaveClass('active');
  expect(screen.getByRole('button', { name: /^beer$/i })).toHaveClass('active');
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

test('add lot with qty 0 does not call the collection endpoint', () => {
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(global.fetch).not.toHaveBeenCalledWith(
    '/api/wine/1/collection',
    expect.anything()
  );
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

// ── Quantity validation ────────────────────────────────────────────

test('add lot with decimal quantity shows error and does not call the endpoint', () => {
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '2.5' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(screen.getByText('Quantity must be a positive whole number.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith('/api/wine/1/collection', expect.objectContaining({ method: 'POST' }));
});

test('add lot with blank quantity shows error and does not call the endpoint', () => {
  renderEditPage({ ...EDIT_DRINK, collection: [] });
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(screen.getByText('Quantity must be a positive whole number.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith('/api/wine/1/collection', expect.objectContaining({ method: 'POST' }));
});

// ── Collection photo upload ────────────────────────────────────────

test('shows placeholder when no collection photo is set', () => {
  renderEditPage();
  expect(screen.getByTestId('collection-placeholder')).toBeInTheDocument();
});

test('shows collection photo thumbnail when collectionImageUrl is set', () => {
  renderEditPage({ ...EDIT_DRINK, collectionImageUrl: '/images/drinks/col.jpg' });
  expect(screen.getByTestId('collection-img')).toHaveAttribute('src', '/images/drinks/col.jpg');
});

test('uploading a collection photo updates the thumbnail', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ collectionImageUrl: '/images/drinks/new-col.jpg' }) })
  );
  renderEditPage();
  const file = new File(['x'], 'bottle.jpg', { type: 'image/jpeg' });
  fireEvent.click(screen.getByTestId('collection-img-upload-trigger'));
  fireEvent.change(screen.getByTestId('collection-img-upload'), { target: { files: [file] } });
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection/image',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );
  });
  expect(await screen.findByTestId('collection-img')).toHaveAttribute('src', '/images/drinks/new-col.jpg');
  expect(await screen.findByText('Photo updated!')).toBeInTheDocument();
});

test('collection photo upload failure shows error message', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  renderEditPage();
  const file = new File(['x'], 'bottle.jpg', { type: 'image/jpeg' });
  fireEvent.click(screen.getByTestId('collection-img-upload-trigger'));
  fireEvent.change(screen.getByTestId('collection-img-upload'), { target: { files: [file] } });
  expect(await screen.findByText('Failed to upload photo.')).toBeInTheDocument();
});

test('shows a large photo preview when a collection photo is set', () => {
  renderEditPage({ ...EDIT_DRINK, collectionImageUrl: '/images/drinks/col.jpg' });
  expect(screen.getByTestId('collection-preview-img')).toHaveAttribute('src', '/images/drinks/col.jpg');
});

test('does not show a large photo preview when no collection photo is set', () => {
  renderEditPage();
  expect(screen.queryByTestId('collection-preview-img')).not.toBeInTheDocument();
});
