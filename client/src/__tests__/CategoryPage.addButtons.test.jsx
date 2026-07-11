import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
import CategoryPage from '../pages/CategoryPage';

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
});

test('Add Review navigates to admin with this page\'s category and the Review tab', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^add review$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { category: 'wine', tab: 'review' } });
});

test('Add to Collection navigates to admin with this page\'s category and the Collection tab', async () => {
  render(<MemoryRouter><CategoryPage category="beer" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /^add to collection$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', { state: { category: 'beer', tab: 'collection' } });
});
