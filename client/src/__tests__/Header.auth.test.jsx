import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
});

test('renders a user avatar and a hover menu with the email and sign-out link when /auth/me resolves', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ email: 'noamros9@gmail.com' }) })
  );
  render(<MemoryRouter><Header /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('N')).toBeInTheDocument());
  expect(screen.getByText('noamros9@gmail.com')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign out' })).toHaveAttribute('href', '/auth/logout');
});

test('renders no user badge when /auth/me returns 401', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  render(<MemoryRouter><Header /></MemoryRouter>);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/auth/me'));
  expect(screen.queryByRole('link', { name: 'Sign out' })).not.toBeInTheDocument();
});
