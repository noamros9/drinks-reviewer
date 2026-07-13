import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: () => <input data-testid="mock-datepicker" type="text" readOnly />,
}));

const WINE = { id: 'w1', producer: 'Château X', seriesAndName: 'Grand Cru', wineCategory: 'Red', country: 'France', tags: [] };

function mockFetch(drinks = [WINE]) {
  global.fetch = vi.fn((url) => {
    if (url === '/api/tags') return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(drinks) });
  });
}

beforeEach(() => mockFetch());

test('loading /admin?id=&category= pre-fills the form and switches to edit mode', async () => {
  render(
    <MemoryRouter initialEntries={['/admin?id=w1&category=wine']}>
      <AdminPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByDisplayValue('Château X')).toBeInTheDocument());
  expect(screen.getByText('Château X — Grand Cru')).toBeInTheDocument();
});

test('category query param selects the right category before the drink loads', async () => {
  render(
    <MemoryRouter initialEntries={['/admin?id=w1&category=wine']}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByLabelText(/sweetness/i)).toBeInTheDocument();
});

test('deep link shows Edit Entry immediately, not a flash of Add Entry', async () => {
  render(
    <MemoryRouter initialEntries={['/admin?id=w1&category=wine']}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByText('Edit Entry')).toBeInTheDocument();
  expect(screen.queryByText('Add Entry')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByDisplayValue('Château X')).toBeInTheDocument());
  expect(screen.getByText('Château X — Grand Cru')).toBeInTheDocument();
});

test('unmatched id query param leaves the form in create mode', async () => {
  render(
    <MemoryRouter initialEntries={['/admin?id=missing&category=wine']}>
      <AdminPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine'));
  expect(screen.getByText('Add Entry')).toBeInTheDocument();
});

test('location.state.drink takes precedence over query params', () => {
  const stateDrink = { id: 'w2', producer: 'From State', seriesAndName: 'X', tags: [] };
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', search: '?id=w1&category=wine', state: { category: 'wine', drink: stateDrink } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByDisplayValue('From State')).toBeInTheDocument();
});

test('deep-linking to a wine auto-focuses the Vivino Score field', async () => {
  render(
    <MemoryRouter initialEntries={['/admin?id=w1&category=wine']}>
      <AdminPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByLabelText('Vivino Score')).toHaveFocus());
});

test('location.state.drink does not steal focus onto the Vivino Score field', () => {
  const stateDrink = { id: 'w2', producer: 'From State', seriesAndName: 'X', tags: [] };
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', search: '?id=w1&category=wine', state: { category: 'wine', drink: stateDrink } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByLabelText('Vivino Score')).not.toHaveFocus();
});
