import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange }) => (
    <input data-testid="mock-datepicker" type="text" onChange={(e) => onChange(e.target.value ? new Date('2025-06-01') : null)} />
  ),
}));

beforeEach(() => {
  global.fetch = vi.fn((url, opts) => {
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

function postedTo(url) {
  return global.fetch.mock.calls.some(([u, opts]) => u === url && opts?.method === 'POST');
}

test('submitting a review with Producer, Name, Country all blank prompts a confirm listing them', async () => {
  window.confirm = vi.fn(() => false);
  renderAdmin();
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining('Producer')
  );
  expect(window.confirm.mock.calls[0][0]).toContain('Series & Name');
  expect(window.confirm.mock.calls[0][0]).toContain('Country of Origin');
  expect(postedTo('/api/wine')).toBe(false);
});

test('cancelling the missing-fields confirm aborts the save', async () => {
  window.confirm = vi.fn(() => false);
  renderAdmin();
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  expect(postedTo('/api/wine')).toBe(false);
});

test('confirming through the missing-fields prompt proceeds with the save', async () => {
  window.confirm = vi.fn(() => true);
  renderAdmin();
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => expect(postedTo('/api/wine')).toBe(true));
});

test('no confirm is shown when Producer, Name, and Country are all filled', async () => {
  window.confirm = vi.fn(() => true);
  renderAdmin();
  fireEvent.change(screen.getByLabelText(/producer/i), { target: { value: 'Chateau Margaux' } });
  fireEvent.change(screen.getByLabelText(/series & name/i), { target: { value: 'Grand Vin' } });
  fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'France' } });
  fireEvent.submit(screen.getByRole('button', { name: /^add$/i }).closest('form'));
  await waitFor(() => expect(postedTo('/api/wine')).toBe(true));
  expect(window.confirm).not.toHaveBeenCalled();
});

test('editing an existing entry does not gate on missing required fields', async () => {
  window.confirm = vi.fn();
  renderAdmin({ category: 'wine', drink: { id: '1', producer: '', seriesAndName: '' } });
  fireEvent.submit(screen.getByRole('button', { name: /update/i }).closest('form'));
  await waitFor(() => expect(postedTo('/api/wine')).toBe(false));
  expect(global.fetch.mock.calls.some(([u, opts]) => u === '/api/wine/1' && opts?.method === 'PUT')).toBe(true);
  expect(window.confirm).not.toHaveBeenCalled();
});

test('adding to collection with Producer, Name, Country blank prompts a confirm listing them', async () => {
  window.confirm = vi.fn(() => false);
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^add to collection$/i }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Producer'));
  expect(window.confirm.mock.calls[0][0]).toContain('Name');
  expect(window.confirm.mock.calls[0][0]).toContain('Country');
  expect(postedTo('/api/wine')).toBe(false);
});

test('confirming through the missing-fields prompt proceeds with adding to collection', async () => {
  window.confirm = vi.fn(() => true);
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^add to collection$/i }));
  await waitFor(() => expect(postedTo('/api/wine')).toBe(true));
});

test('no confirm is shown when the collection form has Producer, Name, and Country filled', async () => {
  window.confirm = vi.fn(() => true);
  renderAdmin();
  fireEvent.click(screen.getByRole('button', { name: /^collection$/i }));
  fireEvent.change(screen.getByLabelText(/^producer$/i), { target: { value: 'Chateau Margaux' } });
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Grand Vin' } });
  fireEvent.change(screen.getByLabelText(/^country$/i), { target: { value: 'France' } });
  fireEvent.click(screen.getByRole('button', { name: /^add to collection$/i }));
  await waitFor(() => expect(postedTo('/api/wine')).toBe(true));
  expect(window.confirm).not.toHaveBeenCalled();
});
