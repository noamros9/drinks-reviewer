import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => <input data-testid="mock-datepicker" type="text" onChange={() => onChange(null)} />,
}));

const wines = [
  { id: '1', producer: 'Torres', seriesAndName: 'Sangre de Toro', country: 'Spain', region: 'Penedès' },
  { id: '2', producer: 'Torres', seriesAndName: 'Santa Digna',    country: 'Chile', region: 'Curicó' },
  { id: '3', producer: 'Torres', seriesAndName: 'Salmos',         country: 'Spain', region: 'Priorat' },
  { id: '4', producer: 'Antinori', seriesAndName: 'Tignanello',   country: 'Italy', region: 'Toscana' },
];

beforeEach(() => {
  window.confirm = vi.fn(() => true);
  global.fetch = vi.fn((url, opts) => {
    if (url === '/api/wine' && !opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve(wines) });
    if (url === '/api/collection') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    if (opts?.method === 'POST' || opts?.method === 'PUT') return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-id' }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
});

function renderAdmin(state = null) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

const producer = () => screen.getByLabelText(/^producer$/i);
const country  = () => screen.getByLabelText(/country/i);
const region   = () => screen.getByLabelText(/region/i);

async function waitForWines() {
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine'));
}

// ── Review form ────────────────────────────────────────────────────

test('picking a producer from the dropdown fills country and region', async () => {
  renderAdmin();
  await waitForWines();
  fireEvent.change(producer(), { target: { value: 'Tor' } });
  fireEvent.mouseDown(await screen.findByText('Torres'));
  expect(producer()).toHaveValue('Torres');
  expect(country()).toHaveValue('Spain');
  expect(region()).toHaveValue('Penedès');
});

test('typing a producer name that exactly matches fills country and region', async () => {
  renderAdmin();
  await waitForWines();
  fireEvent.change(producer(), { target: { value: 'Antinori' } });
  expect(country()).toHaveValue('Italy');
  expect(region()).toHaveValue('Toscana');
});

test('a hand-typed country survives a later producer pick, but the autofilled region is replaced', async () => {
  renderAdmin();
  await waitForWines();
  fireEvent.change(producer(), { target: { value: 'Torres' } });
  fireEvent.change(country(), { target: { value: 'Portugal' } });
  fireEvent.change(producer(), { target: { value: 'Antinori' } });
  expect(country()).toHaveValue('Portugal');
  expect(region()).toHaveValue('Toscana');
});

test('switching category clears the autofilled origin', async () => {
  renderAdmin();
  await waitForWines();
  fireEvent.change(producer(), { target: { value: 'Torres' } });
  expect(country()).toHaveValue('Spain');
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  expect(screen.getByLabelText(/country/i)).toHaveValue('');
});

test('editing an existing entry never autofills country or region', async () => {
  renderAdmin({ drink: { id: '9', producer: 'Old Name', seriesAndName: 'Cuvée', country: '', region: '' }, category: 'wine' });
  await waitForWines();
  fireEvent.change(producer(), { target: { value: 'Torres' } });
  expect(country()).toHaveValue('');
  expect(region()).toHaveValue('');
});

// ── Cellar quick-add form ──────────────────────────────────────────

test('cellar form fills country from the chosen producer', async () => {
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^cellar$/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/collection'));
  fireEvent.change(producer(), { target: { value: 'Tor' } });
  fireEvent.mouseDown(await screen.findByText('Torres'));
  expect(country()).toHaveValue('Spain');
});

test('cellar form leaves a hand-typed country alone', async () => {
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^cellar$/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/collection'));
  fireEvent.change(country(), { target: { value: 'Portugal' } });
  fireEvent.change(producer(), { target: { value: 'Torres' } });
  expect(country()).toHaveValue('Portugal');
});

test('switching cellar category clears the autofilled origin', async () => {
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^cellar$/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/collection'));
  fireEvent.change(producer(), { target: { value: 'Torres' } });
  expect(country()).toHaveValue('Spain');
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/beer'));
  fireEvent.change(country(), { target: { value: 'Belgium' } });
  fireEvent.change(producer(), { target: { value: 'Torres' } });
  expect(country()).toHaveValue('Belgium');
});
