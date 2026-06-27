import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
});

test('hamburger button renders', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByTestId('hamburger')).toBeInTheDocument();
});

test('hamburger has aria-expanded=false initially', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByTestId('hamburger')).toHaveAttribute('aria-expanded', 'false');
});

test('clicking hamburger adds nav-open class to header', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('hamburger'));
  expect(document.querySelector('header')).toHaveClass('nav-open');
});

test('clicking hamburger sets aria-expanded=true', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('hamburger'));
  expect(screen.getByTestId('hamburger')).toHaveAttribute('aria-expanded', 'true');
});

test('clicking hamburger twice closes nav', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  const btn = screen.getByTestId('hamburger');
  fireEvent.click(btn); // open
  fireEvent.click(btn); // close
  expect(document.querySelector('header')).not.toHaveClass('nav-open');
});
