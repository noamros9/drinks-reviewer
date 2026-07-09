import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasteCardPage from '../pages/TasteCardPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const RESULT = {
  profile: {
    category: 'wine', entryCount: 3, wineCategory: 'Red', variety: 'Pinot Noir', country: 'France',
    abv: { avg: 13, min: 12.5, max: 13.5 }, topTags: ['light', 'earthy'],
  },
  disliked: { category: 'wine', entryCount: 1, variety: 'Merlot', country: 'Spain', topTags: [] },
  summary: 'You lean toward light, earthy Pinot Noir from France.',
  availableInIsrael: [{ name: 'Some Wine', description: 'crisp red', url: 'https://example.com/wine' }],
  notAvailable: [{ name: 'Rare Wine', description: 'hard to find' }],
};

function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><TasteCardPage /></MemoryRouter>);
}

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(RESULT) }));
});

test('shows a loading message while waiting for the taste card', () => {
  renderAt('/taste-card?category=wine');
  expect(screen.getByText(/Building your taste card/)).toBeInTheDocument();
});

test('renders the profile card and both result groups once the call resolves', async () => {
  renderAt('/taste-card?category=wine');
  const card = await screen.findByTestId('taste-profile');
  expect(card).toHaveTextContent('Pinot Noir');
  expect(card).toHaveTextContent('France');
  expect(card).toHaveTextContent('13 (12.5–13.5)');
  expect(card).toHaveTextContent('light');
  expect(card).toHaveTextContent('earthy');
  expect(screen.getByText(RESULT.summary)).toBeInTheDocument();
  expect(screen.getByText('What you tend to avoid')).toBeInTheDocument();
  expect(screen.getByTestId('taste-profile-disliked')).toHaveTextContent('Merlot');
  expect(screen.getByTestId('taste-card-available')).toHaveTextContent('Some Wine');
  expect(screen.getByTestId('taste-card-unavailable')).toHaveTextContent('Rare Wine');
});

test('renders a multi-modal field as a joined list', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      profile: { category: 'wine', entryCount: 2, variety: ['Pinot Noir', 'Chardonnay'], topTags: [] },
      disliked: null,
      summary: '',
      availableInIsrael: [],
      notAvailable: [],
    }),
  }));
  renderAt('/taste-card?category=wine');
  const card = await screen.findByTestId('taste-profile');
  expect(card).toHaveTextContent('Pinot Noir / Chardonnay');
});

test('shows no "What you tend to avoid" block when disliked is null', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      profile: { category: 'wine', entryCount: 1, topTags: [] },
      disliked: null,
      summary: '',
      availableInIsrael: [],
      notAvailable: [],
    }),
  }));
  renderAt('/taste-card?category=wine');
  await screen.findByTestId('taste-profile');
  expect(screen.queryByText('What you tend to avoid')).not.toBeInTheDocument();
});

test('sends the category from the query string', async () => {
  renderAt('/taste-card?category=wine');
  await screen.findByTestId('taste-profile');
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe('/api/taste-card');
  expect(JSON.parse(opts.body)).toEqual({ category: 'wine' });
});

test('shows the server error message when the call fails', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: false,
    json: () => Promise.resolve({ error: 'No rated drinks in this category yet' }),
  }));
  renderAt('/taste-card?category=beer');
  expect(await screen.findByText('No rated drinks in this category yet')).toBeInTheDocument();
});

test('falls back to a generic error message when none is provided', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.reject() }));
  renderAt('/taste-card?category=beer');
  expect(await screen.findByText(/Couldn.t build a taste card/)).toBeInTheDocument();
});

test('shows empty-state copy for groups with no results', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ profile: { category: 'wine', entryCount: 1, topTags: [] }, availableInIsrael: [], notAvailable: [] }),
  }));
  renderAt('/taste-card?category=wine');
  await screen.findByTestId('taste-profile');
  expect(screen.getByText('No purchasable matches found.')).toBeInTheDocument();
  expect(screen.getByText('Nothing else to show.')).toBeInTheDocument();
});

test('Back button navigates back', async () => {
  renderAt('/taste-card?category=wine');
  fireEvent.click(await screen.findByText('← Back'));
  expect(mockNavigate).toHaveBeenCalledWith(-1);
});

test('Go back button in the error state navigates back', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.reject() }));
  renderAt('/taste-card?category=beer');
  fireEvent.click(await screen.findByText('Go back'));
  expect(mockNavigate).toHaveBeenCalledWith(-1);
});
