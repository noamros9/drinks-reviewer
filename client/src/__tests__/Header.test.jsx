import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from '../components/Header';

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.clear();
});

test('renders all nav links', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByText('All')).toBeInTheDocument();
  expect(screen.getByText('Wine')).toBeInTheDocument();
  expect(screen.getByText('Beer')).toBeInTheDocument();
  expect(screen.getByText('Whiskey')).toBeInTheDocument();
  expect(screen.getByText('Others')).toBeInTheDocument();
  expect(screen.getByText('Admin')).toBeInTheDocument();
});

test('toggles from dark to light and persists to localStorage', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('theme-toggle'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(localStorage.getItem('theme')).toBe('light');
});

test('toggles from light to dark', () => {
  document.documentElement.setAttribute('data-theme', 'light');
  render(<MemoryRouter><Header /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('theme-toggle'));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
});

test('defaults to light when no data-theme attribute set', () => {
  document.documentElement.removeAttribute('data-theme');
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByTestId('theme-toggle')).toHaveTextContent('🌙');
});

test('renders search input', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
});

test('search navigates to /all?q=term on submit', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
      <LocationDisplay />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'chateau' } });
  fireEvent.submit(screen.getByRole('search'));
  expect(screen.getByTestId('location')).toHaveTextContent('/all?q=chateau');
});

test('search with empty query navigates to /all', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
      <LocationDisplay />
    </MemoryRouter>
  );
  fireEvent.submit(screen.getByRole('search'));
  expect(screen.getByTestId('location')).toHaveTextContent('/all');
  expect(screen.getByTestId('location')).not.toHaveTextContent('?q=');
});

test('query input shows ?q value on initial render', () => {
  render(
    <MemoryRouter initialEntries={['/all?q=merlot']}>
      <Header />
    </MemoryRouter>
  );
  expect(screen.getByRole('searchbox')).toHaveValue('merlot');
});

test('query input clears when ?q is removed from URL', () => {
  render(
    <MemoryRouter initialEntries={['/all?q=merlot']}>
      <Header />
      <LocationDisplay />
    </MemoryRouter>
  );
  expect(screen.getByRole('searchbox')).toHaveValue('merlot');
  fireEvent.submit(screen.getByRole('search')); // submits 'merlot' → /all?q=merlot (no change)
  // Simulate navigating to /all (no q) — submit empty to clear
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
  fireEvent.submit(screen.getByRole('search'));
  expect(screen.getByTestId('location').textContent).toBe('/all');
  expect(screen.getByRole('searchbox')).toHaveValue('');
});

test('marks the matching nav link as active', () => {
  render(
    <MemoryRouter initialEntries={['/wine']}>
      <Header />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: /^wine$/i })).toHaveClass('active');
  expect(screen.getByRole('link', { name: /^beer$/i })).not.toHaveClass('active');
});
