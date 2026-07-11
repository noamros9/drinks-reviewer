import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => <input data-testid="mock-datepicker" type="text" readOnly onClick={() => onChange(new Date('2026-01-05'))} />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const LOT = { id: 'lot1', quantity: 2, price: 30, addedAt: '2026-01-01' };
const DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: '', abv: '13',
  lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '',
  collection: [LOT],
};

function renderDrankIt() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: DRINK, drankIt: true, lot: LOT } }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

test('lands on Review tab in drankIt mode', () => {
  renderDrankIt();
  expect(screen.getByRole('button', { name: /^review$/i })).toHaveClass('active');
});

test('saving in drankIt mode sends collectionOnly: false on PUT', async () => {
  renderDrankIt();
  fireEvent.submit(screen.getByRole('button', { name: /update/i }).closest('form'));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"collectionOnly":false') })
    );
  });
});

test('saving in drankIt mode PATCHes the lot', async () => {
  renderDrankIt();
  fireEvent.submit(screen.getByRole('button', { name: /update/i }).closest('form'));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection/lot1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantity: 1 }) })
    );
  });
});

test('saving in drankIt mode navigates to /collection', async () => {
  renderDrankIt();
  fireEvent.submit(screen.getByRole('button', { name: /update/i }).closest('form'));
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/collection');
  });
});

// ── Drank it → Tastings tab (already-reviewed drinks) ─────────────

const REVIEWED_DRINK = { ...DRINK, tastings: [{ id: 't1', date: '01/01/2025', rating: 8 }] };

function renderDrankItTastings(drink = REVIEWED_DRINK) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink, drankIt: true, lot: LOT, tab: 'tastings' } }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

test('lands on Tastings tab in drankIt mode when tab is "tastings"', () => {
  renderDrankItTastings();
  expect(screen.getByRole('button', { name: /^tastings$/i })).toHaveClass('active');
});

test('adding a tasting in drankIt mode PATCHes the lot and navigates to /collection', async () => {
  const updatedDrink = { ...REVIEWED_DRINK, tastings: [...REVIEWED_DRINK.tastings, { id: 't2', date: '05/01/2026', rating: 9 }] };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(updatedDrink) }));
  renderDrankItTastings();
  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1/collection/lot1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantity: 1 }) })
    );
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/collection'));
});
