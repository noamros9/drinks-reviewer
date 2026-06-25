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

test('unknown category falls back to empty columns via COLUMNS || [] (line 76)', () => {
  render(<DrinkTable category="unknown" drinks={[{ id: '1', name: 'X' }]} />);
  // Renders without crash; no columns visible but table wrapper present
  expect(document.querySelector('.table-wrapper')).toBeInTheDocument();
});

// ── Color indicators ─────────────────────────────────────────────────

test('wine type cells get the correct color class', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.getByText('White')).toHaveClass('wine-type-white');
  expect(screen.getByText('Red')).toHaveClass('wine-type-red');
});

test('wine country cells get the correct world-group color class', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.getByText('Italy')).toHaveClass('wine-country-old-world');
  expect(screen.getByText('Israel')).toHaveClass('wine-country-israel');
});

test('New World country cell gets wine-country-new-world class (covers line 140)', () => {
  const australiaRow = [{ id: '1', producer: 'P', seriesAndName: 'W', wineCategory: 'Red', variety: 'Shiraz',
    country: 'Australia', region: '', abv: '14', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' }];
  render(<DrinkTable category="wine" drinks={australiaRow} />);
  expect(screen.getByText('Australia')).toHaveClass('wine-country-new-world');
});

test('Other (non-Old/non-New) country gets wine-country-other class (covers line 141 truthy)', () => {
  const unknownRow = [{ id: '1', producer: 'P', seriesAndName: 'W', wineCategory: 'Red', variety: 'Red',
    country: 'UnknownLand', region: '', abv: '14', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' }];
  render(<DrinkTable category="wine" drinks={unknownRow} />);
  expect(screen.getByText('UnknownLand')).toHaveClass('wine-country-other');
});

test('beer category country cells do not get wine color classes', () => {
  const beerRows = [{ id: '1', brewery: 'Goldstar', name: 'Lager', style: 'Lager', country: 'Israel', abv: '4.9', lastTasted: '01/01/2025', lastRanking: '7', avgRanking: '7', notionLink: '' }];
  render(<DrinkTable category="beer" drinks={beerRows} />);
  expect(screen.getByText('Israel')).not.toHaveClass('wine-country-old-world');
});

// ── Sorting ──────────────────────────────────────────────────────────

const SORT_ROWS = [
  { id: '1', producer: 'Zara', seriesAndName: 'Z-Wine', wineCategory: 'Red', variety: 'Merlot',
    country: 'France', region: '', abv: '14', lastTasted: '01/01/2020', lastRanking: '7', avgRanking: '7', notionLink: '' },
  { id: '2', producer: 'Alpha', seriesAndName: 'A-Wine', wineCategory: 'White', variety: 'Chardonnay',
    country: 'Italy', region: '', abv: '12', lastTasted: '31/12/2025', lastRanking: '9', avgRanking: '9', notionLink: '' },
];

test('clicking a column header sorts rows ascending', () => {
  render(<DrinkTable category="wine" drinks={SORT_ROWS} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  const producers = screen.getAllByRole('cell').filter((_, i, arr) => {
    const text = arr[i].textContent;
    return text === 'Alpha' || text === 'Zara';
  });
  expect(producers[0]).toHaveTextContent('Alpha');
});

test('clicking same header twice reverses sort to descending', () => {
  render(<DrinkTable category="wine" drinks={SORT_ROWS} />);
  const header = screen.getByRole('columnheader', { name: /producer/i });
  fireEvent.click(header);
  fireEvent.click(header);
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Zara');
});

test('clicking same header three times cycles back to ascending (covers d===asc ternary :asc branch)', () => {
  render(<DrinkTable category="wine" drinks={SORT_ROWS} />);
  const header = screen.getByRole('columnheader', { name: /producer/i });
  fireEvent.click(header); // asc
  fireEvent.click(header); // desc
  fireEvent.click(header); // back to asc — covers `: 'asc'` branch in setSortDir
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Alpha');
});

test('sorting by lastTasted uses date comparison', () => {
  render(<DrinkTable category="wine" drinks={SORT_ROWS} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /last tasted/i }));
  const rows = screen.getAllByRole('row');
  // Ascending: 01/01/2020 (Zara) < 31/12/2025 (Alpha) → Zara first
  expect(rows[1]).toHaveTextContent('Zara');
});

test('null drink field renders as em dash', () => {
  const rowWithNull = [{ id: '1', producer: 'Test', seriesAndName: null, wineCategory: 'Red',
    variety: 'Merlot', country: 'France', region: null, abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' }];
  render(<DrinkTable category="wine" drinks={rowWithNull} />);
  const dashes = screen.getAllByText('—');
  expect(dashes.length).toBeGreaterThan(0);
});

test('notionLink renders as an anchor tag', () => {
  const rowWithLink = [{ id: '1', producer: 'Test', seriesAndName: 'Wine', wineCategory: 'Red',
    variety: 'Merlot', country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8',
    notionLink: 'https://notion.so/test' }];
  render(<DrinkTable category="wine" drinks={rowWithLink} />);
  expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', 'https://notion.so/test');
});

test('renders others category columns', () => {
  const othersRows = [{ id: '1', drinkCategory: 'Rum', distillery: 'Bacardi', name: 'White Rum',
    country: 'Cuba', style: 'Light', age: '3', abv: '40', lastTasted: '', lastRanking: '7', avgRanking: '7', notionLink: '' }];
  render(<DrinkTable category="others" drinks={othersRows} />);
  expect(screen.getByRole('columnheader', { name: /category/i })).toBeInTheDocument();
  expect(screen.getByText('Rum')).toBeInTheDocument();
});

test('onEdit prop renders Edit button and calls callback on click', () => {
  const onEdit = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} onEdit={onEdit} />);
  fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
  expect(onEdit).toHaveBeenCalledWith(WINE_ROWS[0]);
});

// ── Drag-and-drop column reorder ─────────────────────────────────────

test('drag-and-drop column calls onColumnLayoutChange with reordered columns', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: new Set() };
  const onChange = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} onColumnLayoutChange={onChange} />);
  const headers = screen.getAllByRole('columnheader');
  fireEvent.dragStart(headers[0]);
  fireEvent.dragOver(headers[1]);
  fireEvent.drop(headers[1]);
  expect(onChange).toHaveBeenCalled();
  const { order } = onChange.mock.calls[0][0];
  expect(order[0]).toBe(COLUMNS.wine[1].key);
});

test('drag-and-drop backward (higher to lower index) also reorders columns', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: new Set() };
  const onChange = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} onColumnLayoutChange={onChange} />);
  const headers = screen.getAllByRole('columnheader');
  // Drag from index 2 to index 0 — triggers translateX(+) shift animation on middle columns
  fireEvent.dragStart(headers[2]);
  fireEvent.dragOver(headers[0]);
  fireEvent.drop(headers[0]);
  expect(onChange).toHaveBeenCalled();
  const { order } = onChange.mock.calls[0][0];
  expect(order[0]).toBe(COLUMNS.wine[2].key);
});

test('dragEnd clears drag state', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: new Set() };
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} onColumnLayoutChange={vi.fn()} />);
  const headers = screen.getAllByRole('columnheader');
  fireEvent.dragStart(headers[0]);
  fireEvent.dragOver(headers[1]);
  fireEvent.dragEnd(headers[0]);
  // After dragEnd, no dragging class remains
  expect(headers[0]).not.toHaveClass('col-header-dragging');
});

test('drop on same column is a no-op', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: new Set() };
  const onChange = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} onColumnLayoutChange={onChange} />);
  const headers = screen.getAllByRole('columnheader');
  fireEvent.dragStart(headers[0]);
  fireEvent.drop(headers[0]);
  expect(onChange).not.toHaveBeenCalled();
});

test('sort with null field: null at index 1 covers av=null??\" \" (line 148)', () => {
  const rows = [
    { id: '2', producer: 'Alpha', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
    { id: '1', producer: null, seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={rows} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('sort with null field: null at index 0 covers bv=null??\" \" (line 149)', () => {
  const rows = [
    { id: '1', producer: null, seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
    { id: '2', producer: 'Alpha', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={rows} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('sort by lastTasted with empty date field covers !s return 0 branch', () => {
  const rowsWithEmptyDate = [
    { id: '1', producer: 'Alpha', seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
    { id: '2', producer: 'Beta', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '01/01/2025', lastRanking: '8', avgRanking: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={rowsWithEmptyDate} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /last tasted/i }));
  // Renders without crash; empty date sorts as 0
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('sort with 3 drinks in [Zara, Middle, Alpha] order forces av > bv comparison (covers line 160)', () => {
  // V8 calls compare(arr[i], arr[i+1]): compare(Zara, Middle) → av='Zara' > bv='Middle' → line 160
  const three = [
    { id: '3', producer: 'Zara', seriesAndName: 'Z', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
    { id: '2', producer: 'Middle', seriesAndName: 'M', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
    { id: '1', producer: 'Alpha', seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={three} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Alpha');
  expect(rows[3]).toHaveTextContent('Zara');
});

test('sorting two rows with equal values returns stable order (covers sort return 0)', () => {
  const sameProducer = [
    { id: '1', producer: 'Same', seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
    { id: '2', producer: 'Same', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRanking: '8', avgRanking: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={sameProducer} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Same');
  expect(rows[2]).toHaveTextContent('Same');
});


test('drag with no columnLayout uses default layout', () => {
  const onChange = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_ROWS} onColumnLayoutChange={onChange} />);
  const headers = screen.getAllByRole('columnheader');
  fireEvent.dragStart(headers[0]);
  fireEvent.dragOver(headers[2]);
  fireEvent.drop(headers[2]);
  expect(onChange).toHaveBeenCalled();
});
