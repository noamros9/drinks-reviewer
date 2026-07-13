import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => (
    <input data-testid="mock-datepicker" type="text" onChange={(e) => onChange(e.target.value ? new Date('2025-06-01') : null)} />
  ),
}));

const existingWine = { id: '1', producer: 'Chateau Margaux', seriesAndName: 'Grand Vin' };

beforeEach(() => {
  global.fetch = vi.fn((url, opts) => {
    if (url === '/api/wine') return Promise.resolve({ ok: true, json: () => Promise.resolve([existingWine]) });
    if (opts?.method === 'POST' || opts?.method === 'PUT') return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-id' }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
});

function renderAdmin(state = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

async function waitForCatalogue() {
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine'));
}

test('no warning when producer/name do not match an existing entry', async () => {
  renderAdmin();
  await waitForCatalogue();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: 'Chateau Margaux' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: 'Something Else' } });
  expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument();
});

test('shows inline warning when producer + name match an existing entry', async () => {
  renderAdmin();
  await waitForCatalogue();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: 'Chateau Margaux' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: 'Grand Vin' } });
  expect(screen.getByTestId('duplicate-warning')).toHaveTextContent('Chateau Margaux');
});

test('warning is case/whitespace-insensitive', async () => {
  renderAdmin();
  await waitForCatalogue();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: ' CHATEAU MARGAUX ' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: ' grand vin ' } });
  expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument();
});

test('submitting a duplicate prompts window.confirm; cancelling aborts the save', async () => {
  window.confirm = vi.fn(() => false);
  renderAdmin();
  await waitForCatalogue();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: 'Chateau Margaux' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: 'Grand Vin' } });
  fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'France' } });
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Chateau Margaux'));
  expect(global.fetch.mock.calls.some(([url, opts]) => url === '/api/wine' && opts?.method === 'POST')).toBe(false);
});

test('submitting a duplicate and confirming proceeds with the save', async () => {
  window.confirm = vi.fn(() => true);
  renderAdmin();
  await waitForCatalogue();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: 'Chateau Margaux' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: 'Grand Vin' } });
  fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'France' } });
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => {
    expect(global.fetch.mock.calls.some(([url, opts]) => url === '/api/wine' && opts?.method === 'POST')).toBe(true);
  });
});

test('editing an entry does not flag itself as a duplicate', async () => {
  renderAdmin({ category: 'wine', drink: existingWine });
  await waitForCatalogue();
  expect(screen.queryByTestId('duplicate-warning')).not.toBeInTheDocument();
});

test('editing an entry still flags a collision with a different existing entry', async () => {
  const otherWine = { id: '2', producer: 'Domaine Leflaive', seriesAndName: 'Puligny-Montrachet' };
  global.fetch = vi.fn((url, opts) => {
    if (url === '/api/wine') return Promise.resolve({ ok: true, json: () => Promise.resolve([existingWine, otherWine]) });
    if (opts?.method === 'POST' || opts?.method === 'PUT') return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-id' }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderAdmin({ category: 'wine', drink: existingWine });
  await waitForCatalogue();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: 'Domaine Leflaive' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: 'Puligny-Montrachet' } });
  expect(screen.getByTestId('duplicate-warning')).toHaveTextContent('Domaine Leflaive');
});
