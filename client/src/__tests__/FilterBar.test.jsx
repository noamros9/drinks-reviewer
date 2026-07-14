import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters } from '../utils/filterHelpers';

const WINES = [
  { id: '1', producer: 'Citra',     wineCategory: 'Red',   variety: ['Sangiovese'],       country: 'Italy',  region: 'Abruzzo' },
  { id: '2', producer: 'Latroun',   wineCategory: 'White', variety: ['Chardonnay'],        country: 'Israel', region: 'Judean Hills' },
  { id: '3', producer: 'ChateauX',  wineCategory: 'Red',   variety: ['Cabernet', 'Merlot'],   country: 'France', region: 'Bordeaux' },
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

test('clear all resets all filters', () => {
  const activeFilters = { ...buildInitialFilters('wine'), producerSearch: 'cit' };
  const onChange = vi.fn();
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={activeFilters}
      onChange={onChange}
    />
  );
  fireEvent.click(screen.getByText('Clear all'));
  const reset = onChange.mock.calls[0][0];
  expect(reset.producerSearch).toBe('');
  expect(reset.abvMin).toBe('');
  expect(reset.abvMax).toBe('');
  expect(reset.wineCategory.size).toBe(0);
});

test('renders ColumnPanel when onColumnLayoutChange is provided', () => {
  const activeFilters = buildInitialFilters('wine');
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={activeFilters}
      onChange={vi.fn()}
      columnLayout={null}
      onColumnLayoutChange={vi.fn()}
    />
  );
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
});

test('unknown category falls back to empty configs and default producer label', () => {
  render(
    <FilterBar
      category="unknown"
      drinks={[]}
      activeFilters={{ producerSearch: '', abvMin: '', abvMax: '' }}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByTestId('producer-search')).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/search producer/i)).toBeInTheDocument();
});

test('dropdown onChange lambda calls parent onChange with updated filter', () => {
  const onChange = vi.fn();
  const activeFilters = buildInitialFilters('wine');
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={activeFilters}
      onChange={onChange}
    />
  );
  fireEvent.click(screen.getByTestId('filter-dropdown-type'));
  // Click the "Red" label text to toggle the checkbox
  fireEvent.click(screen.getByText('Red'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ wineCategory: expect.any(Set) }));
  expect(onChange.mock.calls[0][0].wineCategory.has('Red')).toBe(true);
});

test('abv onChange lambda calls parent onChange with abv values', () => {
  const onChange = vi.fn();
  const activeFilters = buildInitialFilters('wine');
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={activeFilters}
      onChange={onChange}
    />
  );
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '12' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ abvMin: '12' }));
});

test('activeFilters missing conf key falls back to empty Set', () => {
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={{ producerSearch: '', abvMin: '', abvMax: '' }}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByTestId('filter-dropdown-type')).toBeInTheDocument();
});

test('null abvMin/abvMax fall back to empty string via ??', () => {
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={{ producerSearch: '', abvMin: null, abvMax: null }}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByTestId('filter-abv')).toBeInTheDocument();
});

test('onColumnLayoutChange with unknown category hits COLUMNS || [] fallback', () => {
  render(
    <FilterBar
      category="unknown"
      drinks={[]}
      activeFilters={{ producerSearch: '', abvMin: '', abvMax: '' }}
      onChange={vi.fn()}
      columnLayout={null}
      onColumnLayoutChange={vi.fn()}
    />
  );
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
});

test('tags dropdown shows count next to each tag option', () => {
  const drinks = [
    { id: '1', producer: 'A', wineCategory: 'Red', variety: ['Merlot'], country: 'France', region: '', tags: ['organic', 'gift'] },
    { id: '2', producer: 'B', wineCategory: 'White', variety: ['Chardonnay'], country: 'Italy', region: '', tags: ['organic'] },
    { id: '3', producer: 'C', wineCategory: 'Red', variety: ['Cabernet'], country: 'Spain', region: '', tags: [] },
  ];
  renderBar('wine', drinks);
  fireEvent.click(screen.getByTestId('filter-dropdown-tags'));
  expect(screen.getByText('organic')).toBeInTheDocument();
  expect(screen.getByText('gift')).toBeInTheDocument();
  const countSpans = document.querySelectorAll('.filter-option-count');
  const countValues = [...countSpans].map(s => s.textContent);
  expect(countValues).toContain('2'); // organic appears in 2 drinks
  expect(countValues).toContain('1'); // gift appears in 1 drink
});

test('clear all also resets abv filter', () => {
  const activeFilters = { ...buildInitialFilters('wine'), abvMin: '10', abvMax: '15' };
  const onChange = vi.fn();
  render(
    <FilterBar
      category="wine"
      drinks={WINES}
      activeFilters={activeFilters}
      onChange={onChange}
    />
  );
  expect(screen.getByText('Clear all')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Clear all'));
  const reset = onChange.mock.calls[0][0];
  expect(reset.abvMin).toBe('');
  expect(reset.abvMax).toBe('');
});
