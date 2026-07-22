import { render, screen } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }));
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'light');
});

test('renders without crashing and shows the logo', () => {
  render(<App />);
  expect(screen.getByText('Drinks Reviewer')).toBeInTheDocument();
});

test('renders nav with Admin link', () => {
  render(<App />);
  expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument();
});

test('suppresses the Header nav on public catalog/share routes', () => {
  window.history.pushState({}, '', '/catalog');
  render(<App />);
  expect(screen.queryByText('Drinks Reviewer')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
});
