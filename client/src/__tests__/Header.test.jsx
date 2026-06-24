import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';

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
