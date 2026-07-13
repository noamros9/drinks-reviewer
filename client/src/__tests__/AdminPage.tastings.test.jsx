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
  lastTasted: '15/03/2025', lastRating: 8, avgRating: 8,
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
    country: 'Germany', abv: '5', lastTasted: '', lastRating: 7, avgRating: 7,
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

test('shows large preview of most recent tasting image', () => {
  const drinkWithImg = { ...EDIT_DRINK, tastings: [{ ...TASTING, imageUrl: '/images/drinks/abc.jpg' }] };
  renderTastingsTab(drinkWithImg);
  expect(screen.getByTestId('tastings-preview-img')).toHaveAttribute('src', '/images/drinks/abc.jpg');
});

test('does not show preview when most recent tasting has no image', () => {
  renderTastingsTab();
  expect(screen.queryByTestId('tastings-preview-img')).not.toBeInTheDocument();
});

test('shows Add photo button when tasting has no image', () => {
  renderTastingsTab();
  expect(screen.getAllByText(/add photo/i).length).toBeGreaterThan(0);
});

test('shows thumbnail and Change photo when tasting has imageUrl', () => {
  const drinkWithImg = { ...EDIT_DRINK, tastings: [{ ...TASTING, imageUrl: '/images/drinks/abc.jpg' }] };
  renderTastingsTab(drinkWithImg);
  expect(screen.getByTestId('tasting-img-t1')).toHaveAttribute('src', '/images/drinks/abc.jpg');
  expect(screen.getByText(/change photo/i)).toBeInTheDocument();
});

test('uploading an image calls POST with FormData and updates tastings', async () => {
  const updatedDrink = { ...EDIT_DRINK, tastings: [{ ...TASTING, imageUrl: '/images/drinks/new.jpg' }] };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedDrink) });
  renderTastingsTab();
  fireEvent.click(screen.getByTestId('img-upload-t1-trigger'));
  const fileInput = screen.getByTestId('img-upload-t1');
  const file = new File(['x'], 'bottle.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/wine/1/tastings/t1/image',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
  ));
  await waitFor(() => expect(screen.getByText(/change photo/i)).toBeInTheDocument());
});

test('file input with no file does not call fetch', () => {
  renderTastingsTab();
  fireEvent.click(screen.getByTestId('img-upload-t1-trigger'));
  fireEvent.change(screen.getByTestId('img-upload-t1'), { target: { files: [] } });
  expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/image'), expect.anything());
});

test('shows error when image upload fails', async () => {
  global.fetch.mockResolvedValue({ ok: false });
  renderTastingsTab();
  fireEvent.click(screen.getByTestId('img-upload-t1-trigger'));
  const fileInput = screen.getByTestId('img-upload-t1');
  const file = new File(['x'], 'bottle.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(/failed to upload/i)).toBeInTheDocument());
});

test('add-tasting form has a photo file input', () => {
  renderTastingsTab();
  fireEvent.click(screen.getByTestId('new-tasting-img-trigger'));
  expect(screen.getByTestId('new-tasting-img')).toBeInTheDocument();
});

test('adding a tasting with an image uploads image to new tasting id', async () => {
  const newTasting = { id: 't2', date: '15/03/2025', rating: 9 };
  const updatedDrink = { ...EDIT_DRINK, tastings: [TASTING, newTasting] };
  const updatedWithImg = { ...EDIT_DRINK, tastings: [TASTING, { ...newTasting, imageUrl: '/images/drinks/new.jpg' }] };
  global.fetch
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })              // /api/tags on mount
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedDrink) })   // POST tasting
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedWithImg) }); // POST image
  renderTastingsTab();

  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } });
  const file = new File(['x'], 'bottle.jpg', { type: 'image/jpeg' });
  fireEvent.click(screen.getByTestId('new-tasting-img-trigger'));
  fireEvent.change(screen.getByTestId('new-tasting-img'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/wine/1/tastings/t2/image',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
  ));
});

// ── Inline tasting edit ───────────────────────────────────────────

test('Edit button appears on each tasting row', () => {
  renderTastingsTab();
  expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
});

test('clicking Edit shows inline inputs with current values', () => {
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  expect(screen.getByTestId('edit-tasting-date')).toHaveValue('15/03/2025');
  expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
});

test('Cancel exits edit mode and restores display', () => {
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(screen.queryByTestId('edit-tasting-date')).not.toBeInTheDocument();
  expect(screen.getByText('15/03/2025')).toBeInTheDocument();
});

test('Save calls PUT and updates tasting list', async () => {
  const updated = { ...EDIT_DRINK, tastings: [{ ...TASTING, date: '20/04/2025', rating: 9 }] };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) });
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  fireEvent.change(screen.getByTestId('edit-tasting-date'), { target: { value: '20/04/2025' } });
  fireEvent.change(screen.getByTestId('edit-tasting-rating'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/wine/1/tastings/t1',
    expect.objectContaining({ method: 'PUT' })
  ));
  await waitFor(() => expect(screen.getByText('20/04/2025')).toBeInTheDocument());
});

test('Save shows error when PUT fails', async () => {
  global.fetch.mockResolvedValue({ ok: false });
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(screen.getByText(/failed to update/i)).toBeInTheDocument());
});

test('vintage input appears in edit mode for wine and is editable', () => {
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  const vintageInput = screen.getByTestId('edit-tasting-vintage');
  expect(vintageInput).toHaveValue('2021');
  fireEvent.change(vintageInput, { target: { value: '2022' } });
  expect(vintageInput).toHaveValue('2022');
});

test('photo/edit/remove buttons share one right-aligned action group regardless of category', () => {
  const beerDrink = {
    id: 'b1', brewery: 'BrewCo', name: 'Lager', style: 'Lager',
    country: 'Germany', abv: '5', tags: [],
    tastings: [{ id: 't1', date: '01/01/2024', rating: 7 }],
  };
  renderTastingsTab(beerDrink, 'beer');
  const actions = document.querySelector('.tasting-row-actions');
  expect(actions).toBeInTheDocument();
  expect(actions.querySelector('.btn-upload-img')).toBeInTheDocument();
  expect(actions.querySelector('.btn-tasting-edit')).toBeInTheDocument();
  expect(actions.querySelector('.btn-danger')).toBeInTheDocument();
});

test('vintage input absent in edit mode for non-wine', () => {
  const beerDrink = {
    id: 'b1', brewery: 'BrewCo', name: 'Lager', style: 'Lager',
    country: 'Germany', abv: '5', tags: [],
    tastings: [{ id: 't1', date: '01/01/2024', rating: 7 }],
  };
  renderTastingsTab(beerDrink, 'beer');
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  expect(screen.queryByPlaceholderText('Vintage')).not.toBeInTheDocument();
});

// ── Derived read-only fields on Review tab ────────────────────────

test('derived fields render as read-only on review tab when editing', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByDisplayValue('15/03/2025')).toHaveAttribute('readonly');
  const readonlyInputs = screen.getAllByDisplayValue('8');
  readonlyInputs.forEach(el => expect(el).toHaveAttribute('readonly'));
});

test('adding a tasting updates the review tab derived fields without a reload', async () => {
  const newTasting = { id: 't2', date: '20/04/2025', rating: 10 };
  const updatedDrink = { ...EDIT_DRINK, tastings: [TASTING, newTasting], lastTasted: '20/04/2025', lastRating: 10, avgRating: 9 };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedDrink) });
  renderTastingsTab();

  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /add tasting/i }));
  await waitFor(() => expect(screen.getByText(/tasting added/i)).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /^review$/i }));
  expect(screen.getByDisplayValue('20/04/2025')).toBeInTheDocument();
  expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  expect(screen.getByDisplayValue('9')).toBeInTheDocument();
});

test('removing the last tasting clears the review tab derived fields', async () => {
  const updatedDrink = { id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red', variety: 'Merlot', country: 'France', region: '', abv: '13', notionLink: '', tags: [], tastings: [] };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedDrink) });
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(screen.queryByText('15/03/2025')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /^review$/i }));
  expect(screen.queryByText('Last Tasted')).not.toBeInTheDocument();
  expect(screen.queryByText('Avg Rating')).not.toBeInTheDocument();
});

test('saving an edited tasting updates the review tab derived fields', async () => {
  const updated = { ...EDIT_DRINK, tastings: [{ ...TASTING, date: '20/04/2025', rating: 9 }], lastTasted: '20/04/2025', lastRating: 9, avgRating: 9 };
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) });
  renderTastingsTab();
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  fireEvent.change(screen.getByTestId('edit-tasting-date'), { target: { value: '20/04/2025' } });
  fireEvent.change(screen.getByTestId('edit-tasting-rating'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(screen.getByText('20/04/2025')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /^review$/i }));
  expect(screen.getByDisplayValue('20/04/2025')).toBeInTheDocument();
  expect(screen.getAllByDisplayValue('9').length).toBeGreaterThan(0);
});
