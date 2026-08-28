import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => <input data-testid="mock-datepicker" type="text" onChange={() => onChange(null)} />,
}));

const wines = [
  { id: '1', producer: 'Antinori', seriesAndName: 'Tignanello', country: 'Italy', region: 'Toscana' },
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

function renderAdmin() {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: null }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

const country = () => screen.getByLabelText(/country/i);
const region  = () => screen.getByLabelText(/region/i);
const warning = () => screen.queryByTestId('region-offlist-warning');

async function waitForWines() {
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine'));
}

async function setOrigin(countryVal, regionVal) {
  renderAdmin();
  await waitForWines();
  fireEvent.change(country(), { target: { name: 'country', value: countryVal } });
  fireEvent.change(region(),  { target: { name: 'region',  value: regionVal } });
}

test('a region in the taxonomy raises no warning', async () => {
  await setOrigin('France', 'Loire Valley / Sancerre');
  expect(warning()).not.toBeInTheDocument();
});

test('a top-level region in the taxonomy raises no warning', async () => {
  await setOrigin('Italy', 'Toscana');
  expect(warning()).not.toBeInTheDocument();
});

test('a misspelled parent is flagged', async () => {
  await setOrigin('France', 'Loire / Sancerre');
  expect(warning()).toBeInTheDocument();
  expect(warning()).toHaveTextContent(/Loire \/ Sancerre/);
});

// The migration targets: these are children now, so the old flat value is off-list.
test('a region that should now be nested is flagged', async () => {
  await setOrigin('Italy', 'Chianti');
  expect(warning()).toBeInTheDocument();
});

// Whiskey regions live nowhere in wine-regions.json; flagging them all would be noise.
test('a country absent from the taxonomy is never flagged', async () => {
  await setOrigin('Scotland', 'Speyside');
  expect(warning()).not.toBeInTheDocument();
});

test('an empty region is not flagged', async () => {
  await setOrigin('France', '');
  expect(warning()).not.toBeInTheDocument();
});

test('the warning clears once the region is corrected', async () => {
  await setOrigin('France', 'Loire / Sancerre');
  expect(warning()).toBeInTheDocument();
  fireEvent.change(region(), { target: { name: 'region', value: 'Loire Valley / Sancerre' } });
  expect(warning()).not.toBeInTheDocument();
});

test('saving an off-list region asks for confirmation and keeps the typed value verbatim', async () => {
  await setOrigin('France', 'Loire / Sancerre');
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { name: 'producer', value: 'Someone' } });
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

  await waitFor(() => expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining("\"Loire / Sancerre\" isn't a known region for France")
  ));
  const post = global.fetch.mock.calls.find(([, o]) => o?.method === 'POST');
  expect(JSON.parse(post[1].body).region).toBe('Loire / Sancerre');
});

test('declining the confirmation aborts the save', async () => {
  window.confirm = vi.fn(() => false);
  await setOrigin('France', 'Loire / Sancerre');
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { name: 'producer', value: 'Someone' } });
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

  await waitFor(() => expect(window.confirm).toHaveBeenCalled());
  expect(global.fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
});
