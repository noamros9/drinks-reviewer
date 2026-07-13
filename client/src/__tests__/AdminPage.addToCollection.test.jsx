import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => <input data-testid="mock-datepicker" type="text" onChange={() => onChange(null)} />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderCollectionTab() {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
}

function mockFetch(overrides = {}) {
  global.fetch = vi.fn((url, opts) => {
    if (overrides[url]) return Promise.resolve(overrides[url]);
    if (opts?.method === 'POST') {
      if (/\/collection\/image$/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      if (/\/collection$/.test(url)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'lot1' }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-drink' }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

beforeEach(() => {
  mockNavigate.mockClear();
  window.confirm = vi.fn(() => true);
  mockFetch();
});

test('shows category selector in collection tab create mode', () => {
  renderCollectionTab();
  expect(screen.getByRole('button', { name: /^wine$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^beer$/i })).toBeInTheDocument();
});

test('shows producer, name, country, ABV, quantity, price fields', () => {
  renderCollectionTab();
  expect(screen.getByLabelText(/^producer$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^country$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/abv/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^quantity$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^price$/i)).toBeInTheDocument();
});

test('submit POSTs drink with collectionOnly: true', async () => {
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { value: 'Château X' } });
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Reserve' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"collectionOnly":true') })
    );
  });
});

test('submit then POSTs a lot to the new drink id', async () => {
  renderCollectionTab();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/new-drink/collection',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

test('navigates to collection after submit', async () => {
  renderCollectionTab();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/collection');
  });
});

test('"Add another Collection" submits without navigating and resets the form', async () => {
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { value: 'Château X' } });
  fireEvent.click(screen.getByRole('button', { name: /^add another$/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"collectionOnly":true') })
    );
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/^producer$/i)).toHaveValue('');
});

test('switching category changes the POST endpoint', async () => {
  renderCollectionTab();
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/beer',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

test('includes price in lot body when price is filled', async () => {
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^price$/i), { target: { value: '45.50' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/new-drink/collection',
      expect.objectContaining({ body: expect.stringContaining('"price":45.5') })
    );
  });
});

test('shows error message when drink POST fails', async () => {
  mockFetch({ '/api/wine': { ok: false } });
  renderCollectionTab();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(await screen.findByText(/failed to add drink/i)).toBeInTheDocument();
});

// ── Quantity validation blocks entire submit ──────────────────────

test('decimal quantity blocks the entire submit', () => {
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '2.5' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(screen.getByText('Quantity must be a positive whole number.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith('/api/wine', expect.objectContaining({ method: 'POST' }));
});

test('zero quantity blocks the entire submit', () => {
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(screen.getByText('Quantity must be a positive whole number.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith('/api/wine', expect.objectContaining({ method: 'POST' }));
});

test('blank quantity blocks the entire submit', () => {
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(screen.getByText('Quantity must be a positive whole number.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith('/api/wine', expect.objectContaining({ method: 'POST' }));
});

// ── Producer/country autocomplete ─────────────────────────────────

test('autocomplete suggestions populate from reviewed drinks and appear in producer/country fields', async () => {
  mockFetch({ '/api/wine': { ok: true, json: () => Promise.resolve([{ producer: 'Domaine Test', country: 'France' }]) } });
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { value: 'Dom' } });
  await waitFor(() => expect(screen.getByText('Domaine Test')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/^country$/i), { target: { value: 'Fra' } });
  await waitFor(() => expect(screen.getByText('France')).toBeInTheDocument());
});

test('autocomplete also includes producers that only exist as collection-only entries (no review)', async () => {
  mockFetch({
    '/api/wine': { ok: true, json: () => Promise.resolve([]) },
    '/api/collection': {
      ok: true,
      json: () => Promise.resolve([
        { _category: 'wine', collectionOnly: true, producer: 'Cellar Only Estate', country: 'Spain' },
        { _category: 'beer', collectionOnly: true, producer: 'Other Category Brewery', country: 'Belgium' },
      ]),
    },
  });
  renderCollectionTab();
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { value: 'Cellar' } });
  await waitFor(() => expect(screen.getByText('Cellar Only Estate')).toBeInTheDocument());
  expect(screen.queryByText('Other Category Brewery')).not.toBeInTheDocument();
});

// ── Quick-add photo upload ─────────────────────────────────────────

test('quick-add photo upload fires to the collection image endpoint after drink+lot are created', async () => {
  renderCollectionTab();
  const file = new File(['x'], 'bottle.jpg', { type: 'image/jpeg' });
  fireEvent.click(screen.getByTestId('new-col-img-trigger'));
  fireEvent.change(screen.getByTestId('new-col-img'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/wine/new-drink/collection/image',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
  ));
});
