import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
import AllDrinksPage from '../pages/AllDrinksPage';

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
});

test('on the "All" tab, Add Review navigates without a category preset', () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^add review$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { tab: 'review' } });
});

test('on the "All" tab, Add to Collection navigates without a category preset', () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^add to collection$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { tab: 'collection' } });
});

test('after selecting the Wine tab, Add Review navigates with the wine category preset', () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^wine$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^add review$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { category: 'wine', tab: 'review' } });
});

test('after selecting the Wine tab, Add to Collection navigates with the wine category preset', () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^wine$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^add to collection$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { category: 'wine', tab: 'collection' } });
});
