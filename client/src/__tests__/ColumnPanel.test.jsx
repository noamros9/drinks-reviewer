import { render, screen, fireEvent } from '@testing-library/react';
import ColumnPanel from '../components/ColumnPanel';
import { COLUMNS } from '../components/DrinkTable';

const WINE_COLS = COLUMNS.wine;

function renderPanel(layoutOverride, onChange = vi.fn()) {
  render(
    <ColumnPanel
      allColumns={WINE_COLS}
      columnLayout={layoutOverride}
      onChange={onChange}
    />
  );
  return onChange;
}

test('button renders with label "Columns"', () => {
  renderPanel(null);
  expect(screen.getByTestId('column-panel-btn')).toHaveTextContent('Columns');
});

test('does not show hidden count when nothing is hidden', () => {
  renderPanel(null);
  const btn = screen.getByTestId('column-panel-btn');
  expect(btn.querySelector('.filter-count')).not.toBeInTheDocument();
});

test('shows hidden count badge when columns are hidden', () => {
  const layout = { order: WINE_COLS.map(c => c.key), hidden: new Set(['region', 'abv']) };
  renderPanel(layout);
  expect(screen.getByTestId('column-panel-btn').querySelector('.filter-count')).toBeInTheDocument();
});

test('opens panel and renders all columns as checkboxes', () => {
  renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  WINE_COLS.forEach(col => {
    expect(screen.getByTestId(`col-toggle-${col.key}`)).toBeInTheDocument();
  });
});

test('all columns are checked by default', () => {
  renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  WINE_COLS.forEach(col => {
    expect(screen.getByTestId(`col-toggle-${col.key}`)).toBeChecked();
  });
});

test('unchecking a column calls onChange with it in hidden set', () => {
  const onChange = renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-region'));
  expect(onChange).toHaveBeenCalledOnce();
  const { hidden } = onChange.mock.calls[0][0];
  expect(hidden.has('region')).toBe(true);
});

test('hidden column checkbox appears unchecked', () => {
  const layout = { order: WINE_COLS.map(c => c.key), hidden: new Set(['region']) };
  renderPanel(layout);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  expect(screen.getByTestId('col-toggle-region')).not.toBeChecked();
});

test('Reset to default button calls onChange with null', () => {
  const layout = { order: WINE_COLS.map(c => c.key), hidden: new Set(['region']) };
  const onChange = renderPanel(layout);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByText('Reset to default'));
  expect(onChange).toHaveBeenCalledWith(null);
});
