import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import GeographicSection from '../pages/analytics/GeographicSection';

const DRINKS = [
  { id: 'w1', _category: 'wine', country: 'Italy', region: 'Chianti', avgRating: 7.5 },
  { id: 'w2', _category: 'wine', country: 'France', avgRating: 8 },
  { id: 'b1', _category: 'beer', country: 'Germany', avgRating: 9 },
  { id: 'k1', _category: 'whiskey', country: 'Scotland', region: 'Speyside', avgRating: 9.2 },
  { id: 'o1', _category: 'others', country: 'Japan', avgRating: 4 },
];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  vi.spyOn(window, 'open').mockImplementation(() => {});
});

afterEach(() => {
  window.open.mockRestore();
});

function renderSection(globalCategory = 'all') {
  return render(<GeographicSection drinks={DRINKS} globalCategory={globalCategory} />);
}

function scopeFilter() {
  return within(screen.getByTestId('geo-category-filter'));
}

test('defaults to following the global category (All) and shows the total count', async () => {
  renderSection('all');
  expect(await screen.findByText('5 drinks with country data')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'All' })).toHaveClass('active');
});

test('follows a non-All global category when no local override has been made', async () => {
  renderSection('wine');
  expect(await screen.findByText('2 drinks with country data')).toBeInTheDocument();
});

test('clicking the local scope filter overrides the global category', async () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(await screen.findByText('1 drink with country data')).toBeInTheDocument();
});

test('clicking a country ranking table row opens a new tab to the scoped category with a country filter', async () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Wine' }));
  const rankingTable = within(await screen.findByTestId('country-ranking-table'));
  fireEvent.click(rankingTable.getByText('Italy'));
  expect(window.open).toHaveBeenCalledWith('/wine?country=Italy', '_blank');
});

test('Old World vs New World breakdown always shows all 3 buckets regardless of scope', async () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  await waitFor(() => {
    ['Old World', 'New World', 'Other'].forEach(cat => {
      expect(screen.getByTestId(`bar-${cat}`)).toBeInTheDocument();
    });
  });
});

test('region section is hidden with an empty state when scope has no region data (beer/others)', async () => {
  renderSection('beer');
  expect(await screen.findByText('No region data for this scope.')).toBeInTheDocument();
  expect(screen.queryByTestId('geo-region-country-filter')).not.toBeInTheDocument();
});

test('region section shows the leaderboard and a country pivot when scope has region data', async () => {
  renderSection('wine');
  expect(await screen.findByTestId('geo-region-country-filter')).toBeInTheDocument();
  expect(screen.getByText('Chianti')).toBeInTheDocument();
});

test('clicking a region-country pivot filters the leaderboard without navigating', async () => {
  const drinksWithTwoWineRegions = [
    ...DRINKS,
    { id: 'w3', _category: 'wine', country: 'Spain', region: 'Rioja', avgRating: 8.5 },
  ];
  render(<GeographicSection drinks={drinksWithTwoWineRegions} globalCategory="wine" />);
  await screen.findByText('Chianti');
  expect(screen.getByText('Rioja')).toBeInTheDocument();

  fireEvent.click(within(screen.getByTestId('geo-region-country-filter')).getByRole('button', { name: 'Italy' }));
  expect(screen.getByText('Chianti')).toBeInTheDocument();
  expect(screen.queryByText('Rioja')).not.toBeInTheDocument();
  expect(window.open).not.toHaveBeenCalled();
});

test('a failed region-coordinates fetch does not break the section', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  renderSection('all');
  expect(await screen.findByText('5 drinks with country data')).toBeInTheDocument();
});

test('shows empty state when no drink has a country', async () => {
  const noCountry = DRINKS.map(({ country, ...rest }) => rest);
  render(<GeographicSection drinks={noCountry} globalCategory="all" />);
  expect(await screen.findByText('No country data yet.')).toBeInTheDocument();
});
