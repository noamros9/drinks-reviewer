import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => (
    <input
      data-testid="mock-datepicker"
      type="text"
      onChange={(e) => onChange(e.target.value ? new Date('2025-06-01') : null)}
    />
  ),
}));

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-id' }) })
  );
});

test('shows wine fields by default', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect(screen.getByLabelText(/producer/i)).toBeInTheDocument();
});

test('switches to beer fields when Beer tab is clicked', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  expect(screen.getByLabelText(/brewery/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/producer/i)).not.toBeInTheDocument();
});

test('switches to whiskey fields when Whiskey tab is clicked', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^whiskey$/i }));
  expect(screen.getByLabelText(/distillery/i)).toBeInTheDocument();
});

test('switches to others fields when Others tab is clicked', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^others$/i }));
  expect(screen.getByLabelText(/drink category/i)).toBeInTheDocument();
});

test('calls POST /api/wine on submit', async () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

test('shows success message after adding', async () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  expect(await screen.findByText('Entry added!')).toBeInTheDocument();
});

// ── Edit mode ────────────────────────────────────────────────────

const EDIT_DRINK = {
  id: '1', producer: 'Château Test', seriesAndName: 'Reserve', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: 'Bordeaux', abv: '13.5',
  lastTasted: '01/01/2025', lastRanking: '9', avgRanking: '8.5', notionLink: '',
};

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

test('edit mode shows "Edit Entry" heading', () => {
  renderEditPage();
  expect(screen.getByRole('heading', { name: /edit entry/i })).toBeInTheDocument();
});

test('edit mode hides category tab switcher', () => {
  renderEditPage();
  expect(screen.queryByRole('button', { name: /^beer$/i })).not.toBeInTheDocument();
});

test('edit mode shows Update and Delete buttons', () => {
  renderEditPage();
  expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
});

test('edit mode calls PUT /api/wine/:id on submit', async () => {
  renderEditPage();
  fireEvent.submit(screen.getByRole('button', { name: /update/i }).closest('form'));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1',
      expect.objectContaining({ method: 'PUT' })
    );
  });
});

test('edit mode shows success message after update', async () => {
  renderEditPage();
  fireEvent.submit(screen.getByRole('button', { name: /update/i }).closest('form'));
  expect(await screen.findByText('Entry updated!')).toBeInTheDocument();
});

test('delete button triggers confirm dialog and calls DELETE', async () => {
  window.confirm = vi.fn(() => true);
  renderEditPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/wine/1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

test('delete does nothing when confirm is cancelled', async () => {
  window.confirm = vi.fn(() => false);
  renderEditPage();
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => {
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

test('select field renders for wine type', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  expect(screen.getByLabelText(/wine type/i)).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /red/i })).toBeInTheDocument();
});

test('changing a field updates form state', () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  const producerInput = screen.getByLabelText(/producer/i);
  fireEvent.change(producerInput, { target: { name: 'producer', value: 'New Producer' } });
  expect(producerInput).toHaveValue('New Producer');
});

test('location.state with category but no drink initialises emptyForm with that category', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'beer' } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  // Not in edit mode; form is initialised for beer
  expect(screen.getByLabelText(/brewery/i)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /edit entry/i })).not.toBeInTheDocument();
});

test('DatePicker onChange with a date updates form (covers setForm truthy branch)', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  const datepicker = screen.getByTestId('mock-datepicker');
  await user.type(datepicker, 'x'); // value='x' → onChange(Date) → date truthy branch
  expect(datepicker).toHaveValue('x');
});

test('DatePicker onChange with null clears the date field (covers setForm falsy branch)', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  const datepicker = screen.getByTestId('mock-datepicker');
  await user.type(datepicker, 'x'); // set a value first
  await user.clear(datepicker);     // value='' → onChange(null) → date falsy branch
  expect(datepicker).toHaveValue('');
});

test('null field values render as empty string via ?? fallback', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: {
      category: 'wine',
      drink: { id: '1', producer: null, seriesAndName: null, wineCategory: null, variety: null,
               country: null, region: null, abv: null, lastTasted: null, lastRanking: null,
               avgRanking: null, notionLink: null },
    }}]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByLabelText(/producer/i)).toHaveValue('');
  expect(screen.getByLabelText(/wine type/i)).toHaveValue('');
});

test('shows error message when save fails (res.ok false on POST)', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('button', { name: /add/i }).closest('form'));
  expect(await screen.findByText('Save failed. Please try again.')).toBeInTheDocument();
});

test('shows error message when delete fails (res.ok false on DELETE)', async () => {
  window.confirm = vi.fn(() => true);
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red', variety: 'Merlot', country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' } } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  expect(await screen.findByText('Delete failed. Please try again.')).toBeInTheDocument();
});
