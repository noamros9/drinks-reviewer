import { render, screen, fireEvent } from '@testing-library/react';
import DrinkTable from '../components/DrinkTable';

const WINE_ROWS = [
  { id: '1', producer: 'Citra', seriesAndName: 'Bisanzio', wineCategory: 'White', variety: 'Pinot Grigio',
    country: 'Italy', region: 'Abruzzo', abv: '12.5' },
  { id: '2', producer: 'Latroun', seriesAndName: 'Reserve', wineCategory: 'Red', variety: 'Merlot',
    country: 'Israel', region: 'Judean Hills', abv: '13' },
];

test('no checkbox column when selectedIds is not provided', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.queryByLabelText('Select all rows')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/select row/i)).not.toBeInTheDocument();
});

test('renders a checkbox per row plus a select-all checkbox when selectedIds is provided', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} selectedIds={new Set()} onToggleRow={() => {}} onToggleAll={() => {}} />);
  expect(screen.getByLabelText('Select all rows')).toBeInTheDocument();
  expect(screen.getByLabelText('Select row 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Select row 2')).toBeInTheDocument();
});

test('row checkbox reflects selectedIds and calls onToggleRow with the drink id', () => {
  const onToggleRow = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} selectedIds={new Set(['1'])} onToggleRow={onToggleRow} onToggleAll={() => {}} />);
  expect(screen.getByLabelText('Select row 1')).toBeChecked();
  expect(screen.getByLabelText('Select row 2')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Select row 2'));
  expect(onToggleRow).toHaveBeenCalledWith('2');
});

test('select-all checkbox is unchecked when not every visible row is selected, and calls onToggleAll(ids, true)', () => {
  const onToggleAll = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} selectedIds={new Set(['1'])} onToggleRow={() => {}} onToggleAll={onToggleAll} />);
  expect(screen.getByLabelText('Select all rows')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Select all rows'));
  expect(onToggleAll).toHaveBeenCalledWith(['1', '2'], true);
});

test('select-all checkbox is checked when every visible row is selected, and calls onToggleAll(ids, false)', () => {
  const onToggleAll = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} selectedIds={new Set(['1', '2'])} onToggleRow={() => {}} onToggleAll={onToggleAll} />);
  expect(screen.getByLabelText('Select all rows')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Select all rows'));
  expect(onToggleAll).toHaveBeenCalledWith(['1', '2'], false);
});
