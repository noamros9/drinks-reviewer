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

// ── Pointer-based drag reorder (touch + mouse) ────────────────────

function dragRow(fromRow, toRow) {
  const spy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(toRow);
  fireEvent.pointerDown(fromRow, { pointerId: 1 });
  fireEvent.pointerMove(fromRow, { pointerId: 1, clientX: 1, clientY: 1 });
  fireEvent.pointerUp(fromRow, { pointerId: 1 });
  spy.mockRestore();
}

test('drag reorder calls onChange with reordered columns (forward)', () => {
  const onChange = renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  const firstRow  = screen.getByTestId(`col-panel-row-${WINE_COLS[0].key}`);
  const secondRow = screen.getByTestId(`col-panel-row-${WINE_COLS[1].key}`);
  dragRow(firstRow, secondRow);
  expect(onChange).toHaveBeenCalled();
  const { order } = onChange.mock.calls[0][0];
  expect(order[0]).toBe(WINE_COLS[1].key);
  expect(order[1]).toBe(WINE_COLS[0].key);
});

test('drag reorder calls onChange with reordered columns (backward)', () => {
  const onChange = renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  const firstRow  = screen.getByTestId(`col-panel-row-${WINE_COLS[0].key}`);
  const thirdRow  = screen.getByTestId(`col-panel-row-${WINE_COLS[2].key}`);
  dragRow(thirdRow, firstRow);
  expect(onChange).toHaveBeenCalled();
  const { order } = onChange.mock.calls[0][0];
  expect(order[0]).toBe(WINE_COLS[2].key);
});

test('drag to same row is a no-op', () => {
  const onChange = renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  const firstRow = screen.getByTestId(`col-panel-row-${WINE_COLS[0].key}`);
  dragRow(firstRow, firstRow);
  expect(onChange).not.toHaveBeenCalled();
});

test('pointerdown without a move (simple click) clears drag state without reordering', () => {
  const onChange = renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  const firstRow = screen.getByTestId(`col-panel-row-${WINE_COLS[0].key}`);
  fireEvent.pointerDown(firstRow, { pointerId: 1 });
  fireEvent.pointerUp(firstRow, { pointerId: 1 });
  expect(onChange).not.toHaveBeenCalled();
  expect(firstRow).not.toHaveClass('col-panel-dragging');
});

test('re-checking a hidden column removes it from hidden set (toggleColumn delete branch)', () => {
  const layout = { order: WINE_COLS.map(c => c.key), hidden: new Set(['region']) };
  const onChange = renderPanel(layout);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  // region is currently hidden (unchecked) — clicking it shows it (removes from hidden)
  fireEvent.click(screen.getByTestId('col-toggle-region'));
  const { hidden } = onChange.mock.calls[0][0];
  expect(hidden.has('region')).toBe(false);
});

test('order key with no matching column renders null (unknown key skipped)', () => {
  const layout = { order: [...WINE_COLS.map(c => c.key), 'deleted_col'], hidden: new Set() };
  renderPanel(layout);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  // Panel still renders without crash; deleted_col row simply not shown
  expect(screen.queryByTestId('col-panel-row-deleted_col')).not.toBeInTheDocument();
  expect(screen.getByTestId(`col-panel-row-${WINE_COLS[0].key}`)).toBeInTheDocument();
});

test('adds alignRight modifier class when menu overflows the right edge', () => {
  const getRectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ right: window.innerWidth + 50 });
  renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  expect(document.querySelector('.filter-dropdown-menu--right')).toBeInTheDocument();
  getRectSpy.mockRestore();
});

test('does not add alignRight modifier class when menu fits on screen', () => {
  const getRectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ right: window.innerWidth - 50 });
  renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  expect(document.querySelector('.filter-dropdown-menu--right')).not.toBeInTheDocument();
  getRectSpy.mockRestore();
});

test('mousedown outside closes the panel', () => {
  renderPanel(null);
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  expect(screen.getByTestId(`col-toggle-${WINE_COLS[0].key}`)).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByTestId(`col-toggle-${WINE_COLS[0].key}`)).not.toBeInTheDocument();
});
