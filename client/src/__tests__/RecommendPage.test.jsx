import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecommendPage from '../pages/RecommendPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const RESULT = {
  ownCatalogue: [{ id: '1', category: 'wine', label: 'Citra Bisanzio', reason: 'similar style' }],
  availableInIsrael: [{ name: 'Some Wine', description: 'crisp white', url: 'https://example.com/wine', reason: 'x' }],
  notAvailable: [{ name: 'Rare Wine', description: 'hard to find' }],
};

const WINE_DRINKS = [{ id: '1', producer: 'Citra', seriesAndName: 'Bisanzio' }];

function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><RecommendPage /></MemoryRouter>);
}

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn((url) => {
    if (url === '/api/recommend') return Promise.resolve({ ok: true, json: () => Promise.resolve(RESULT) });
    if (url === '/api/wine') return Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_DRINKS) });
    return Promise.resolve({ ok: false });
  });
});

test('shows a loading message while waiting for the recommendation', () => {
  renderAt('/recommend?seeds=1:wine,2:wine');
  expect(screen.getByText(/Finding recommendations/)).toBeInTheDocument();
});

test('renders all three result groups once the call resolves', async () => {
  renderAt('/recommend?seeds=1:wine,2:wine');
  expect(await screen.findByTestId('recommend-own-catalogue')).toHaveTextContent('Citra Bisanzio');
  expect(screen.getByTestId('recommend-available')).toHaveTextContent('Some Wine');
  expect(screen.getByTestId('recommend-unavailable')).toHaveTextContent('Rare Wine');
});

test('clicking an own-catalogue match navigates to admin with the full drink', async () => {
  renderAt('/recommend?seeds=1:wine,2:wine');
  const button = await screen.findByText(/Citra Bisanzio/);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine'));
  fireEvent.click(button);
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: WINE_DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('shows an error state when the API call fails', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  renderAt('/recommend?seeds=1:wine,2:wine');
  expect(await screen.findByText(/Couldn.t get recommendations/)).toBeInTheDocument();
});

test('shows an error state when no seeds are given', () => {
  renderAt('/recommend?seeds=');
  expect(screen.getByText(/Couldn.t get recommendations/)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('accepts a single seed', async () => {
  renderAt('/recommend?seeds=1:wine');
  expect(await screen.findByTestId('recommend-own-catalogue')).toHaveTextContent('Citra Bisanzio');
});

test('shows empty-state copy for groups with no results', async () => {
  global.fetch = vi.fn((url) => {
    if (url === '/api/recommend') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ownCatalogue: [], availableInIsrael: [], notAvailable: [] }),
      });
    }
    return Promise.resolve({ ok: false });
  });
  renderAt('/recommend?seeds=1:wine,2:wine');
  expect(await screen.findByText('No close matches in your catalogue.')).toBeInTheDocument();
  expect(screen.getByText('No purchasable matches found.')).toBeInTheDocument();
  expect(screen.getByText('Nothing else to show.')).toBeInTheDocument();
});

test('Back button navigates back', async () => {
  renderAt('/recommend?seeds=1:wine,2:wine');
  fireEvent.click(await screen.findByText('← Back'));
  expect(mockNavigate).toHaveBeenCalledWith(-1);
});
