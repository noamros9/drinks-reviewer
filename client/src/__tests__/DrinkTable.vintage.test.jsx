import { render, screen, fireEvent } from '@testing-library/react';
import DrinkTable, { COLUMNS, deriveFromFiltered } from '../components/DrinkTable';

const WINE_WITH_TASTINGS = {
  id: 'w1',
  producer: 'TestWinery',
  seriesAndName: 'Reserve',
  wineCategory: 'Red',
  sweetness: 'Dry',
  variety: 'Merlot',
  country: 'France',
  region: 'Bordeaux',
  abv: '13',
  notionLink: '',
  tags: [],
  vintage: '2021',
  lastTasted: '01/06/2025',
  lastRating: 9,
  avgRating: 8,
  tastingCount: 2,
  tastings: [
    { id: 't1', date: '01/01/2024', rating: 7, vintage: '2019' },
    { id: 't2', date: '01/06/2025', rating: 9, vintage: '2021' },
  ],
};

test('renders Vintage column header for wine', () => {
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} />);
  expect(screen.getByRole('columnheader', { name: /vintage/i })).toBeInTheDocument();
});

test('renders Tastings column header for wine', () => {
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} />);
  expect(screen.getByRole('columnheader', { name: /tastings/i })).toBeInTheDocument();
});

test('vintage column shows a select with unique vintages', () => {
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} />);
  const select = screen.getByRole('combobox');
  expect(select).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /all/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '2019' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '2021' })).toBeInTheDocument();
});

test('shows derived cells from all tastings by default (avg 8, count 2)', () => {
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} />);
  // tastingCount = 2 (unique), avgRating = 8 (may also appear in other columns, use getAllByText)
  expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('2')).toBeInTheDocument();
});

test('selecting a vintage filters avgRating and tastingCount', () => {
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} />);
  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: '2019' } });
  // tastingCount drops to 1 and lastTasted changes to the 2019 tasting date
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('01/01/2024')).toBeInTheDocument();
  // avgRating and lastRating both show 7 (duplicated is fine, just check it's present)
  expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
});

test('selecting All restores full-set values', () => {
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} />);
  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: '2019' } });
  fireEvent.change(select, { target: { value: '' } });
  // count goes back to 2, last tasted back to 2021 date
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('01/06/2025')).toBeInTheDocument();
});

test('clicking vintage select does not propagate the click event', () => {
  const onEdit = vi.fn();
  render(<DrinkTable category="wine" drinks={[WINE_WITH_TASTINGS]} onEdit={onEdit} />);
  fireEvent.click(screen.getByRole('combobox'));
  expect(onEdit).not.toHaveBeenCalled();
});

test('wine without tastings shows no vintage dropdown', () => {
  const noTastingWine = { ...WINE_WITH_TASTINGS, id: 'w2', tastings: [] };
  render(<DrinkTable category="wine" drinks={[noTastingWine]} />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('vintage column is not in COLUMNS for non-wine, but tastingCount is', () => {
  expect(COLUMNS.beer.find(c => c.key === 'vintage')).toBeUndefined();
  expect(COLUMNS.beer.find(c => c.key === 'tastingCount')).toBeDefined();
  expect(COLUMNS.whiskey.find(c => c.key === 'vintage')).toBeUndefined();
  expect(COLUMNS.whiskey.find(c => c.key === 'tastingCount')).toBeDefined();
  expect(COLUMNS.others.find(c => c.key === 'tastingCount')).toBeDefined();
});

describe('deriveFromFiltered (unit)', () => {
  it('returns empty object for empty array', () => {
    expect(deriveFromFiltered([], null)).toEqual({});
  });

  it('returns empty object when filter yields no matches', () => {
    const tastings = [{ id: 't1', date: '01/01/2024', rating: 7, vintage: '2019' }];
    expect(deriveFromFiltered(tastings, '2025')).toEqual({});
  });

  it('returns derived fields for all tastings when vintage is null', () => {
    const tastings = [
      { id: 't1', date: '01/01/2024', rating: 7, vintage: '2019' },
      { id: 't2', date: '01/06/2025', rating: 9, vintage: '2021' },
    ];
    const result = deriveFromFiltered(tastings, null);
    expect(result.avgRating).toBe(8);
    expect(result.tastingCount).toBe(2);
  });
});
