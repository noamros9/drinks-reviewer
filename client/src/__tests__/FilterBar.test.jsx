import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters } from '../utils/filterHelpers';

const WINES = [
  { id: '1', producer: 'Citra',     wineCategory: 'Red',   variety: 'Sangiovese',       country: 'Italy',  region: 'Abruzzo' },
  { id: '2', producer: 'Latroun',   wineCategory: 'White', variety: 'Chardonnay',        country: 'Israel', region: 'Judean Hills' },
  { id: '3', producer: 'ChateauX',  wineCategory: 'Red',   variety: 'Cabernet/Merlot',   country: 'France', region: 'Bordeaux' },
];

const BEERS = [
  { id: '4', brewery: 'BrewCo', style: 'IPA',   country: 'USA' },
  { id: '5', brewery: 'HopLab', style: 'Lager', country: 'Germany' },
];

function renderBar(category, drinks, overrides = {}) {
  const activeFilters = { ...buildInitialFilters(category), ...overrides };
  const onChange = vi.fn();
  render(
    <FilterBar
      category={category}
      drinks={drinks}
      activeFilters={activeFilters}
      onChange={onChange}
    />
  );
  return { onChange };
}

test('wine: renders producer search and dropdowns', () => {
  renderBar('wine', WINES);
  expect(screen.getByTestId('producer-search')).toBeInTheDocument();
  expect(screen.getByTestId('filter-dropdown-type')).toBeInTheDocument();
  expect(screen.getByTestId('filter-dropdown-country')).toBeInTheDocument();
  expect(screen.getByTestId('filter-dropdown-variety')).toBeInTheDocument();
  expect(screen.getByTestId('filter-dropdown-region')).toBeInTheDocument();
});

test('beer: renders brewery search and style/country dropdowns', () => {
  renderBar('beer', BEERS);
  expect(screen.getByPlaceholderText(/search brewery/i)).toBeInTheDocument();
  expect(screen.getByTestId('filter-dropdown-style')).toBeInTheDocument();
  expect(screen.getByTestId('filter-dropdown-country')).toBeInTheDocument();
});

test('producer search calls onChange with updated search string', () => {
  const { onChange } = renderBar('wine', WINES);
  fireEvent.change(screen.getByTestId('producer-search'), { target: { value: 'cit' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ producerSearch: 'cit' }));
});

test('country dropdown includes Old World and New World special options', () => {
  renderBar('wine', WINES);
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  expect(screen.getByText('Old World')).toBeInTheDocument();
});

test('variety dropdown includes Blend and Single Variety special options', () => {
  renderBar('wine', WINES);
  fireEvent.click(screen.getByTestId('filter-dropdown-variety'));
  expect(screen.getByText('Blend')).toBeInTheDocument();
  expect(screen.getByText('Single Variety')).toBeInTheDocument();
});

test('clear all button appears only when a filter is active', () => {
  renderBar('wine', WINES);
  expect(screen.queryByText('Clear all')).not.toBeInTheDocument();

  renderBar('wine', WINES, { producerSearch: 'cit' });
  expect(screen.getByText('Clear all')).toBeInTheDocument();
});
