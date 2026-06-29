import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => (
    <input data-testid="mock-datepicker" type="text" onChange={(e) => onChange(e.target.value ? new Date('2025-06-01') : null)} />
  ),
}));

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url === '/api/tags') return Promise.resolve({ ok: true, json: () => Promise.resolve(['cellar', 'gift', 'organic']) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-id' }) });
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
  expect(screen.getByPlaceholderText(/type a tag/i)).toBeInTheDocument();
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
  const input = screen.getByPlaceholderText(/type a tag/i);
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('gift')).toBeInTheDocument();
});

test('clicking × removes a tag chip', () => {
  renderAdmin();
  const input = screen.getByPlaceholderText(/type a tag/i);
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(screen.getByLabelText('Remove gift'));
  expect(screen.queryByText('gift')).not.toBeInTheDocument();
});

test('duplicate tag is not added', () => {
  renderAdmin();
  const input = screen.getByPlaceholderText(/type a tag/i);
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getAllByText('gift')).toHaveLength(1);
});

test('empty tag is not added', () => {
  renderAdmin();
  const input = screen.getByPlaceholderText(/type a tag/i);
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
});

test('tags are included in POST body', async () => {
  renderAdmin();
  const input = screen.getByPlaceholderText(/type a tag/i);
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => {
    const call = global.fetch.mock.calls.find(([url]) => url === '/api/wine');
    const body = JSON.parse(call[1].body);
    expect(body.tags).toContain('gift');
  });
});

test('edit mode shows existing tags', () => {
  renderAdmin({ category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y', tags: ['organic', 'cellar'] } });
  expect(screen.getByText('organic')).toBeInTheDocument();
  expect(screen.getByText('cellar')).toBeInTheDocument();
});

test('adding a tag in edit mode with no prior tags works (covers || [] branch)', () => {
  renderAdmin({ category: 'wine', drink: { id: '1', producer: 'X', seriesAndName: 'Y' } });
  const input = screen.getByPlaceholderText(/type a tag/i);
  fireEvent.change(input, { target: { value: 'gift' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('gift')).toBeInTheDocument();
});
