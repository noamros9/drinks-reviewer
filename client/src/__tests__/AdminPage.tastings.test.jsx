import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange, selected, placeholderText }) => (
    <input
      data-testid="mock-datepicker"
      type="text"
      placeholder={placeholderText}
      value={selected ? 'set' : ''}
      readOnly
      onClick={() => onChange(new Date('2025-03-15'))}
    />
  ),
}));

const TASTING = { id: 't1', date: '15/03/2025', rating: 8, vintage: '2021' };
const EDIT_DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: '', abv: '13',
  lastTasted: '15/03/2025', lastRanking: 8, avgRanking: 8,
  notionLink: '', tags: [], tastings: [TASTING],
};

function renderTastingsTab(drink = EDIT_DRINK, category = 'wine') {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category, drink } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /^tastings$/i }));
}

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
});

test('Tastings tab is present when editing', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('button', { name: /^tastings$/i })).toBeInTheDocument();
});

test('Tastings tab is absent when adding a new entry', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: null }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.queryByRole('button', { name: /^tastings$/i })).not.toBeInTheDocument();
});

test('renders existing tasting rows', () => {
  renderTastingsTab();
  expect(screen.getByText('15/03/2025')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument();
  expect(screen.getByText('2021')).toBeInTheDocument();
});

test('shows vintage column for wine', () => {
  renderTastingsTab();
  expect(screen.getByText('2021')).toBeInTheDocument();
});

test('remove button calls DELETE and updates list', async () => {
  const updatedDrink = { ...EDIT_DRINK, tastings: [] };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedDrink) });
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/tastings/t1'), expect.objectContaining({ method: 'DELETE' })
  ));
  await waitFor(() => expect(screen.queryByText('15/03/2025')).not.toBeInTheDocument());
});

test('add tasting posts to API and updates list', async () => {
  const newTasting = { id: 't2', date: '15/03/2025', rating: 9, vintage: '2022' };
  const updatedDrink = { ...EDIT_DRINK, tastings: [TASTING, newTasting] };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedDrink) });
  renderTastingsTab();

  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } });
  fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2021/i), { target: { value: '2022' } });
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/tastings'), expect.objectContaining({ method: 'POST' })
  ));
});

test('shows dash for missing vintage in wine tasting', () => {
  const drinkWithNoVintage = {
    ...EDIT_DRINK,
    tastings: [{ id: 't2', date: '01/01/2024', rating: 7 }],
  };
  renderTastingsTab(drinkWithNoVintage);
  expect(screen.getByText('—')).toBeInTheDocument();
});

test('no vintage input for non-wine categories', () => {
  const beerDrink = {
    id: 'b1', brewery: 'BrewCo', name: 'Lager', style: 'Lager',
    country: 'Germany', abv: '5', lastTasted: '', lastRanking: 7, avgRanking: 7,
    notionLink: '', tags: [], tastings: [],
  };
  renderTastingsTab(beerDrink, 'beer');
  expect(screen.queryByPlaceholderText(/e\.g\. 2021/i)).not.toBeInTheDocument();
});

test('add without date or rating does not call fetch', async () => {
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));
  expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/tastings'), expect.objectContaining({ method: 'POST' }));
});

test('add wine tasting without vintage omits vintage from body', async () => {
  const updatedDrink = { ...EDIT_DRINK, tastings: [TASTING, { id: 't3', date: '15/03/2025', rating: 9 }] };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedDrink) });
  renderTastingsTab();
  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } });
  // intentionally leave vintage blank
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));
  await waitFor(() => {
    const call = global.fetch.mock.calls.find(c => c[0].includes('/tastings') && c[1]?.method === 'POST');
    expect(call).toBeDefined();
    const body = JSON.parse(call[1].body);
    expect(body.vintage).toBeUndefined();
  });
});

test('shows error message when add tasting fails', async () => {
  global.fetch.mockResolvedValue({ ok: false });
  renderTastingsTab();
  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));
  await waitFor(() => expect(screen.getByText(/failed to add/i)).toBeInTheDocument());
});

test('shows error message when delete tasting fails', async () => {
  global.fetch.mockResolvedValue({ ok: false });
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(screen.getByText(/failed to remove/i)).toBeInTheDocument());
});
