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

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // /api/tags on mount
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'new-drink' }) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'lot1' }) });
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

test('navigates to /collection after submit', async () => {
  renderCollectionTab();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/collection');
  });
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
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // /api/tags on mount
    .mockResolvedValueOnce({ ok: false });
  renderCollectionTab();
  fireEvent.click(screen.getByRole('button', { name: /add to collection/i }));
  expect(await screen.findByText(/failed to add drink/i)).toBeInTheDocument();
});
