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

const LOT = { id: 'lot1', quantity: 2, price: 30, addedAt: '2026-01-01' };
const DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: '', abv: '13',
  lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '',
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
