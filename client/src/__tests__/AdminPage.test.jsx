import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ id: 'new-id' }) })
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
