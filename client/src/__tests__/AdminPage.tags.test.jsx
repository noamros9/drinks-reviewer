import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

// Wine's review form has both a Variety tags-field and a Tags field; scope to the latter.
function getTagsInput() {
  return within(screen.getByText('Tags').closest('.form-group')).getByPlaceholderText(/type a tag/i);
}

function getVarietyInput() {
  return within(screen.getByText('Variety').closest('.form-group')).getByPlaceholderText(/type a tag/i);
}

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => (
    <input data-testid="mock-datepicker" type="text" onChange={(e) => onChange(e.target.value ? new Date('2025-06-01') : null)} />
  ),
}));

beforeEach(() => {
  window.confirm = vi.fn(() => true);
  global.fetch = vi.fn((url, opts) => {
    if (url === '/api/tags') return Promise.resolve({ ok: true, json: () => Promise.resolve(['cellar', 'gift', 'organic']) });
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

test('tags input renders on wine form', () => {
  renderAdmin();
  expect(getTagsInput()).toBeInTheDocument();
});

test('tags input renders on beer form', () => {
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  expect(screen.getByPlaceholderText(/type a tag/i)).toBeInTheDocument();
});

test('sweetness select renders for wine', () => {
  renderAdmin();
  expect(screen.getByLabelText(/sweetness/i)).toBeInTheDocument();
});

test('sweetness select does not render for beer', () => {
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  expect(screen.queryByLabelText(/sweetness/i)).not.toBeInTheDocument();
});

test('typing a tag and pressing Enter adds it as a chip', () => {
  renderAdmin();
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('gift')).toBeInTheDocument();
});

test('focus stays in the tags input after Enter, so a second tag can be typed immediately', () => {
  renderAdmin();
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: 'organic' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('gift')).toBeInTheDocument();
  expect(screen.getByText('organic')).toBeInTheDocument();
});

test('variety input adds a chip and keeps focus after Enter, same as tags', () => {
  renderAdmin();
  const input = getVarietyInput();
  fireEvent.change(input, { target: { value: 'Merlot' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(document.activeElement).toBe(input);
  expect(screen.getByText('Merlot')).toBeInTheDocument();
});

// Chrome ignores autoComplete="off" on fields it heuristically classifies as address
// fields (e.g. anything near a "Country" input), and will hijack Enter to jump focus
// there instead of letting our own tag-adding handler run. A non-standard token like
// "nope" isn't a recognized autofill hint, so Chrome falls back to leaving it alone.
test('tag inputs opt out of browser autofill with a non-off token', () => {
  renderAdmin();
  expect(getVarietyInput()).toHaveAttribute('autoComplete', 'nope');
  expect(getTagsInput()).toHaveAttribute('autoComplete', 'nope');
});

test('focus stays in the collection-tab tags input after Enter (edit mode)', async () => {
  renderAdmin({ category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y', collectionOnly: true } });
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(document.activeElement).toBe(input);
  expect(await screen.findByText('gift')).toBeInTheDocument();
});

test('adding a collection-tab tag does not touch the lot form', async () => {
  renderAdmin({ category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y', collectionOnly: true } });
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  const qtyInput = screen.getByLabelText('Quantity');
  const originalQty = qtyInput.value;
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/wine/1',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ tags: ['gift'] }) })
  ));
  expect(global.fetch).not.toHaveBeenCalledWith('/api/wine/1/collection', expect.anything());
  expect(qtyInput.value).toBe(originalQty);
});

test('clicking × removes a tag chip', () => {
  renderAdmin();
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(screen.getByLabelText('Remove gift'));
  expect(screen.queryByText('gift')).not.toBeInTheDocument();
});

test('duplicate tag is not added', () => {
  renderAdmin();
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getAllByText('gift')).toHaveLength(1);
});

test('empty tag is not added', () => {
  renderAdmin();
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
});

test('tags are included in POST body', async () => {
  renderAdmin();
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => {
    const call = global.fetch.mock.calls.find(([url, opts]) => url === '/api/wine' && opts?.body);
    const body = JSON.parse(call[1].body);
    expect(body.tags).toContain('gift');
  });
});

test('vivino score input renders for wine with 1-5 range', () => {
  renderAdmin();
  const input = screen.getByLabelText(/vivino score/i);
  expect(input).toBeInTheDocument();
  expect(input).toHaveAttribute('min', '1');
  expect(input).toHaveAttribute('max', '5');
  expect(input).toHaveAttribute('step', '0.1');
});

test('vivino score input does not render for beer', () => {
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^beer$/i }));
  expect(screen.queryByLabelText(/vivino score/i)).not.toBeInTheDocument();
});

test('vivino score is included in POST body', async () => {
  renderAdmin();
  fireEvent.change(screen.getByLabelText(/vivino score/i), { target: { value: '4.2' } });
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => {
    const call = global.fetch.mock.calls.find(([url, opts]) => url === '/api/wine' && opts?.body);
    const body = JSON.parse(call[1].body);
    expect(body.vivinoScore).toBe('4.2');
  });
});

test('edit mode shows existing tags', () => {
  renderAdmin({ category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y', tags: ['organic', 'cellar'] } });
  expect(screen.getByText('organic')).toBeInTheDocument();
  expect(screen.getByText('cellar')).toBeInTheDocument();
});

test('adding a tag in edit mode with no prior tags works (covers || [] branch)', () => {
  renderAdmin({ category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y' } });
  const input = getTagsInput();
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('gift')).toBeInTheDocument();
});

test('renders without crashing when /api/tags fetch rejects', async () => {
  global.fetch = vi.fn((url) => {
    if (url === '/api/tags') return Promise.reject(new Error('network error'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-id' }) });
  });
  renderAdmin();
  await waitFor(() => expect(getTagsInput()).toBeInTheDocument());
});
