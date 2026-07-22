import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CatalogPage from '../pages/CatalogPage';

const ENTRIES = [
  { id: '1', category: 'wine', producer: 'Chateau X', name: 'Reserve', avgRating: 8, tastingCount: 1, tastings: [], photo: null },
];

function renderPage() {
  return render(<MemoryRouter><CatalogPage /></MemoryRouter>);
}

test('shows a loading message while waiting for the catalog', () => {
  global.fetch = vi.fn(() => new Promise(() => {}));
  renderPage();
  expect(screen.getByText(/Loading/)).toBeInTheDocument();
});

test('renders curated entries once the call resolves', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(ENTRIES) }));
  renderPage();
  expect(await screen.findByTestId('public-drink-list')).toHaveTextContent('Chateau X — Reserve');
  expect(screen.getByText('1 entry')).toBeInTheDocument();
});

test('shows a private message on 404', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
  renderPage();
  expect(await screen.findByText(/isn.t public/)).toBeInTheDocument();
});

test('shows an error message on unexpected failure', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
  renderPage();
  expect(await screen.findByText(/Couldn.t load the catalog/)).toBeInTheDocument();
});

test('shows empty-state copy for an empty catalog', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  renderPage();
  expect(await screen.findByText('No shared drinks yet.')).toBeInTheDocument();
});
