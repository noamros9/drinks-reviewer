import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExplorationSection from '../pages/analytics/ExplorationSection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const thisYear = new Date().getFullYear();

const DRINKS = [
  {
    id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve', avgRating: 9.5, tastingCount: 1,
    country: 'France', variety: 'Cabernet', lastTasted: '01/01/2000',
    tastings: [{ date: `01/06/${thisYear}` }],
  },
  {
    id: 'w2', _category: 'wine', producer: 'Winery', seriesAndName: 'Blend', avgRating: 8.8, tastingCount: 9,
    country: 'Italy', variety: 'Sangiovese', lastTasted: `01/06/${thisYear}`,
    tastings: [{ date: '01/01/2020' }],
  },
  {
    id: 'b1', _category: 'beer', brewery: 'Brewery', name: 'Ale', avgRating: 6.0, tastingCount: 1,
    country: 'Israel', style: 'IPA', lastTasted: `01/06/${thisYear}`,
    tastings: [{ date: '01/01/2021' }],
  },
];

function renderSection(globalCategory = 'all') {
  return render(
    <MemoryRouter>
      <ExplorationSection drinks={DRINKS} globalCategory={globalCategory} />
    </MemoryRouter>
  );
}

function scopeFilter() {
  return within(screen.getByTestId('exploration-category-filter'));
}

function bestOfTable() {
  return within(screen.getByTestId('best-of-table'));
}

test('under All scope, ranks drinks by weighted rating rather than raw avgRating', () => {
  renderSection('all');
  // w1 (9.5, 1 tasting) still edges out w2 (8.8, 9 tastings) here, but both outrank b1 (6.0, 1 tasting)
  const rows = bestOfTable().getAllByRole('row').slice(1);
  expect(rows[0]).toHaveTextContent('Chateau Reserve');
  expect(rows[1]).toHaveTextContent('Winery Blend');
  expect(rows[2]).toHaveTextContent('Brewery Ale');
});

test('follows the global category when no local override is made', () => {
  renderSection('wine');
  expect(bestOfTable().getByText('Chateau Reserve')).toBeInTheDocument();
  expect(screen.queryByText('Brewery Ale')).not.toBeInTheDocument();
});

test('the local scope filter overrides the global category', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(bestOfTable().getByText('Brewery Ale')).toBeInTheDocument();
  expect(screen.queryByText('Chateau Reserve')).not.toBeInTheDocument();
});

test('shows the empty state when nothing in scope is rated', () => {
  render(
    <MemoryRouter>
      <ExplorationSection drinks={[{ id: 'x', _category: 'wine', avgRating: undefined }]} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.getByText('No rated drinks yet.')).toBeInTheDocument();
});

test('clicking a drink navigates to its Admin tastings tab', () => {
  renderSection('all');
  fireEvent.click(bestOfTable().getByText('Chateau Reserve'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('Explorer Score shows unique countries as a percentage of total, with the country list below', () => {
  const drinks = [
    { id: 'a', _category: 'wine', avgRating: 8, country: 'France' },
    { id: 'b', _category: 'wine', avgRating: 8, country: 'France' },
    { id: 'c', _category: 'wine', avgRating: 8, country: 'Chile' },
    { id: 'd', _category: 'wine', avgRating: 8, country: 'Spain' },
  ];
  render(<MemoryRouter><ExplorationSection drinks={drinks} globalCategory="all" /></MemoryRouter>);
  expect(screen.getByText('75%')).toBeInTheDocument();
  const countryList = within(screen.getByTestId('explorer-score-countries'));
  expect(countryList.getByText('Chile')).toBeInTheDocument();
  expect(countryList.getByText('France')).toBeInTheDocument();
  expect(countryList.getByText('Spain')).toBeInTheDocument();
});

test('Newly Unlocked This Year lists only countries/styles first tasted this year', () => {
  renderSection('all');
  const countries = within(screen.getByTestId('new-countries-list'));
  expect(countries.getByText('France')).toBeInTheDocument();
  expect(countries.queryByText('Italy')).not.toBeInTheDocument();
  expect(countries.queryByText('Israel')).not.toBeInTheDocument();

  const styles = within(screen.getByTestId('new-styles-list'));
  expect(styles.getByText(/Cabernet/)).toBeInTheDocument();
  expect(styles.queryByText(/Sangiovese/)).not.toBeInTheDocument();
  expect(styles.queryByText(/IPA/)).not.toBeInTheDocument();
});

test('Newly Unlocked lists show an empty state when nothing was unlocked this year', () => {
  render(
    <MemoryRouter>
      <ExplorationSection
        drinks={[{ id: 'x', _category: 'wine', avgRating: 8, country: 'Italy', variety: 'Sangiovese', tastings: [{ date: '01/01/2000' }] }]}
        globalCategory="all"
      />
    </MemoryRouter>
  );
  expect(screen.getAllByText('None yet this year.')).toHaveLength(2);
});

test('Drinks to Revisit lists high-rated drinks not tasted in over a year, and row-click navigates', () => {
  renderSection('all');
  const revisit = within(screen.getByTestId('revisit-table'));
  expect(revisit.getByText('Chateau Reserve')).toBeInTheDocument();
  expect(revisit.queryByText('Winery Blend')).not.toBeInTheDocument();
  expect(revisit.queryByText('Brewery Ale')).not.toBeInTheDocument();

  fireEvent.click(revisit.getByText('Chateau Reserve'));
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('Drinks to Revisit shows an empty state when nothing qualifies', () => {
  render(
    <MemoryRouter>
      <ExplorationSection drinks={[{ id: 'x', _category: 'wine', avgRating: 5 }]} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.getByText('Nothing to revisit.')).toBeInTheDocument();
});

test('"Recommend based on my top 10%" navigates with the top-rated ids as seeds', () => {
  renderSection('all');
  fireEvent.click(screen.getByText('Recommend based on my top 10%'));
  expect(mockNavigate).toHaveBeenCalledWith('/recommend?seeds=w1:wine');
});

test('hides the top-10% recommend button when nothing is rated', () => {
  render(
    <MemoryRouter>
      <ExplorationSection drinks={[{ id: 'x', _category: 'wine', avgRating: undefined }]} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.queryByText('Recommend based on my top 10%')).not.toBeInTheDocument();
});
