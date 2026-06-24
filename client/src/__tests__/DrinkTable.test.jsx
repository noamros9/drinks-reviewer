import { render, screen, fireEvent } from '@testing-library/react';
import DrinkTable, { COLUMNS } from '../components/DrinkTable';

const WINE_ROWS = [
  { id: '1', producer: 'Citra', seriesAndName: 'Bisanzio', wineCategory: 'White', variety: 'Pinot Grigio',
    country: 'Italy', region: 'Abruzzo', abv: '12.5', lastTasted: '19/07/2025', lastRanking: '8', avgRanking: '8', notionLink: '' },
  { id: '2', producer: 'Latroun', seriesAndName: 'Reserve', wineCategory: 'Red', variety: 'Merlot',
    country: 'Israel', region: 'Judean Hills', abv: '13', lastTasted: '31/05/2025', lastRanking: '8.5', avgRanking: '8', notionLink: '' },
];

test('renders all default columns for wine', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.getByRole('columnheader', { name: /producer/i })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /country/i })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /variety/i })).toBeInTheDocument();
});

test('hides a column when it appears in columnLayout.hidden', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: new Set(['variety']) };
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} />);
  expect(screen.queryByRole('columnheader', { name: /variety/i })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /country/i })).toBeInTheDocument();
});

test('respects column order from columnLayout', () => {
  const defaultKeys = COLUMNS.wine.map(c => c.key);
  // Move 'country' to the front
  const reordered = ['country', ...defaultKeys.filter(k => k !== 'country')];
  const layout = { order: reordered, hidden: new Set() };
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} />);
  const headers = screen.getAllByRole('columnheader').map(th => th.textContent.replace(/[↑↓×]/g, '').trim());
  expect(headers[0]).toBe('Country');
});

test('× hide button calls onColumnLayoutChange with column added to hidden', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: new Set() };
  const onChange = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} onColumnLayoutChange={onChange} />);
  fireEvent.click(screen.getByTestId('col-hide-variety'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    hidden: expect.any(Set),
  }));
  const { hidden } = onChange.mock.calls[0][0];
  expect(hidden.has('variety')).toBe(true);
});

test('no × hide buttons when onColumnLayoutChange is not provided', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.queryByTestId('col-hide-variety')).not.toBeInTheDocument();
});

test('shows empty state when drinks array is empty', () => {
  render(<DrinkTable category="wine" drinks={[]} />);
  expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
});
