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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  mockNavigate.mockClear();
  window.confirm = vi.fn(() => true);
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

test('"Add another Review" submits without navigating and resets the form', async () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { name: 'producer', value: 'New Producer' } });
  fireEvent.click(screen.getByRole('button', { name: /^add another$/i }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/wine', expect.objectContaining({ method: 'POST' }));
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/producer/i)).toHaveValue('');
});

test('navigates to tastings tab after adding new entry', async () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/admin', {
      state: { drink: { id: 'new-id' }, category: 'wine', tab: 'tastings' },
    });
  });
});

// ── Edit mode ────────────────────────────────────────────────────

const EDIT_DRINK = {
  id: '1', producer: 'Château Test', seriesAndName: 'Reserve', wineCategory: 'Red',
  variety: 'Merlot', country: 'France', region: 'Bordeaux', abv: '13.5',
  lastTasted: '01/01/2025', lastRating: '9', avgRating: '8.5', notionLink: '',
};

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

test('edit mode shows the drink\'s producer + name as the heading', () => {
  renderEditPage();
  expect(screen.getByRole('heading', { name: 'Château Test — Reserve' })).toBeInTheDocument();
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
  const trigger = screen.getByLabelText(/wine type/i);
  expect(trigger).toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByText('Red')).toBeInTheDocument();
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


test('null field values render as empty string via ?? fallback', () => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: {
      category: 'wine',
      drink: { id: '1', producer: null, seriesAndName: null, wineCategory: null, variety: null,
               country: null, region: null, abv: null, lastTasted: null, lastRating: null,
               avgRating: null, notionLink: null },
    }}]}>
      <AdminPage />
    </MemoryRouter>
  );
  expect(screen.getByLabelText(/producer/i)).toHaveValue('');
  expect(screen.getByLabelText(/wine type/i)).toHaveTextContent('Select…');
});

test('shows error message when save fails (res.ok false on POST)', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  expect(await screen.findByText('Save failed. Please try again.')).toBeInTheDocument();
});

test('shows error message when delete fails (res.ok false on DELETE)', async () => {
  window.confirm = vi.fn(() => true);
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red', variety: 'Merlot', country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' } } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  expect(await screen.findByText('Delete failed. Please try again.')).toBeInTheDocument();
});

// ── CustomSelect: pre-selected value + outside-click ─────────────

test('CustomSelect shows cs-selected on matching option and not on placeholder when value is set', () => {
  renderEditPage();
  const trigger = screen.getByLabelText(/wine type/i);
  fireEvent.click(trigger);
  const opts = document.querySelectorAll('.custom-select-menu li');
  const placeholder = opts[0];
  const redOpt = [...opts].find(li => li.textContent === 'Red');
  expect(placeholder.className).not.toContain('cs-selected');
  expect(redOpt.className).toContain('cs-selected');
});

test('clicking outside an open CustomSelect closes it', async () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  const trigger = screen.getByLabelText(/wine type/i);
  fireEvent.click(trigger);
  expect(document.querySelector('.custom-select-menu')).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  await waitFor(() => expect(document.querySelector('.custom-select-menu')).not.toBeInTheDocument());
});

test('selecting an option from CustomSelect updates the value and closes menu', async () => {
  render(<MemoryRouter><AdminPage /></MemoryRouter>);
  const trigger = screen.getByLabelText(/wine type/i);
  fireEvent.click(trigger);
  fireEvent.mouseDown(screen.getByText('Red'));
  await waitFor(() => expect(document.querySelector('.custom-select-menu')).not.toBeInTheDocument());
  expect(trigger).toHaveTextContent('Red');
});

test('selecting the placeholder option in CustomSelect clears the value', async () => {
  renderEditPage();
  const trigger = screen.getByLabelText(/wine type/i);
  fireEvent.click(trigger);
  const opts = document.querySelectorAll('.custom-select-menu li');
  fireEvent.mouseDown(opts[0]);
  await waitFor(() => expect(document.querySelector('.custom-select-menu')).not.toBeInTheDocument());
  expect(trigger).toHaveTextContent('Select…');
});
