import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SharePage from '../pages/SharePage';

const DRINK = {
  id: '1', category: 'wine', producer: 'Chateau X', name: 'Reserve',
  avgRating: 8, tastingCount: 1, tastings: [{ date: '01/01/2025', rating: 8, imageUrl: null }],
  photo: 'https://example.com/photo.png',
};

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/share/:category/:id" element={<SharePage />} /></Routes>
    </MemoryRouter>
  );
}

test('shows a loading message while waiting for the drink', () => {
  global.fetch = vi.fn(() => new Promise(() => {}));
  renderAt('/share/wine/1');
  expect(screen.getByText(/Loading/)).toBeInTheDocument();
});

test('renders the curated drink once the call resolves', async () => {
  global.fetch = vi.fn((url) => {
    expect(url).toBe('/api/public/wine/1');
    return Promise.resolve({ ok: true, json: () => Promise.resolve(DRINK) });
  });
  const { container } = renderAt('/share/wine/1');
  expect(await screen.findByRole('heading', { name: 'Chateau X — Reserve' })).toBeInTheDocument();
  expect(screen.getByText(/8\/10 across 1 tasting/)).toBeInTheDocument();
  expect(screen.getByTestId('share-tastings')).toHaveTextContent('01/01/2025 — 8/10');
  expect(container.querySelector('img')).toHaveAttribute('src', DRINK.photo);
});

test('shows a not-shared message on 404', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
  renderAt('/share/wine/unknown');
  expect(await screen.findByText(/isn.t shared/)).toBeInTheDocument();
});

test('omits the photo and tastings list when absent', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ...DRINK, photo: null, tastings: [], avgRating: null }),
  }));
  renderAt('/share/wine/1');
  await screen.findByRole('heading', { name: 'Chateau X — Reserve' });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByTestId('share-tastings')).not.toBeInTheDocument();
});
