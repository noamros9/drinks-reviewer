import { render, screen, fireEvent } from '@testing-library/react';
import DrinkTable, { COLUMNS } from '../components/DrinkTable';

const WINE_ROWS = [
  { id: '1', producer: 'Citra', seriesAndName: 'Bisanzio', wineCategory: 'White', variety: 'Pinot Grigio',
    country: 'Italy', region: 'Abruzzo', abv: '12.5', lastTasted: '19/07/2025', lastRating: '8', avgRating: '8', notionLink: '' },
  { id: '2', producer: 'Latroun', seriesAndName: 'Reserve', wineCategory: 'Red', variety: 'Merlot',
    country: 'Israel', region: 'Judean Hills', abv: '13', lastTasted: '31/05/2025', lastRating: '8.5', avgRating: '8', notionLink: '' },
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

test('wine type cells get the correct chip class', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.getByText('White')).toHaveClass('chip-wine-white');
  expect(screen.getByText('Red')).toHaveClass('chip-wine-red');
});

test('wine country cells get the correct world-group chip class', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  expect(screen.getByText('Italy')).toHaveClass('chip-country-old-world');
  expect(screen.getByText('Israel')).toHaveClass('chip-country-israel');
});

test('New World country cell gets chip-country-new-world class', () => {
  const australiaRow = [{ id: '1', producer: 'P', seriesAndName: 'W', wineCategory: 'Red', variety: 'Shiraz',
    country: 'Australia', region: '', abv: '14', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' }];
  render(<DrinkTable category="wine" drinks={australiaRow} />);
  expect(screen.getByText('Australia')).toHaveClass('chip-country-new-world');
});

test('Other (non-Old/non-New) country gets chip-country-other class', () => {
  const unknownRow = [{ id: '1', producer: 'P', seriesAndName: 'W', wineCategory: 'Red', variety: 'Red',
    country: 'UnknownLand', region: '', abv: '14', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' }];
  render(<DrinkTable category="wine" drinks={unknownRow} />);
  expect(screen.getByText('UnknownLand')).toHaveClass('chip-country-other');
});

test('beer category country cells do not get wine chip classes', () => {
  const beerRows = [{ id: '1', brewery: 'Goldstar', name: 'Lager', style: 'Lager', country: 'Israel', abv: '4.9', lastTasted: '01/01/2025', lastRating: '7', avgRating: '7', notionLink: '' }];
  render(<DrinkTable category="beer" drinks={beerRows} />);
  expect(screen.getByText('Israel')).not.toHaveClass('chip-country-old-world');
});

test('_category column on All page gets category chip class', () => {
  const allRows = [{ id: '1', _category: 'Wine', _producer: 'Chateau', name: 'Grand Cru', country: 'France', abv: '13', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="all" drinks={allRows} />);
  expect(screen.getByText('Wine')).toHaveClass('chip-cat-wine');
});

test('unknown _category value produces no chip class', () => {
  const allRows = [{ id: '1', _category: 'Unknown', _producer: 'P', name: 'X', country: '', abv: '', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="all" drinks={allRows} />);
  expect(screen.getByText('Unknown')).not.toHaveClass('status-chip');
});

test('drinkCategory on others page gets chip class', () => {
  const othersRows = [{ id: '1', drinkCategory: 'Rum', distillery: 'Bacardi', name: 'Gold', country: 'Cuba', style: '', age: '', abv: '40', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="others" drinks={othersRows} />);
  expect(screen.getByText('Rum')).toHaveClass('chip-others-rum');
});

test('unknown drinkCategory falls back to generic chip', () => {
  const othersRows = [{ id: '1', drinkCategory: 'Brandy', distillery: 'X', name: 'Reserve', country: 'France', style: '', age: '', abv: '40', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="others" drinks={othersRows} />);
  expect(screen.getByText('Brandy')).toHaveClass('chip-others-generic');
});

test('whiskey style gets chip class', () => {
  const whiskeyRows = [{ id: '1', distillery: 'Glenfarclas', name: '105', country: 'Scotland', region: 'Speyside', age: '10', style: 'Single Malt', abv: '60', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="whiskey" drinks={whiskeyRows} />);
  expect(screen.getByText('Single Malt')).toHaveClass('chip-whiskey-singlemalt');
});

test('beer ale-type styles get chip-beer-ale class', () => {
  const beerRows = [{ id: '1', brewery: 'Brew Co', name: 'Pint', style: 'IPA', country: 'UK', abv: '5', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="beer" drinks={beerRows} />);
  expect(screen.getByText('IPA')).toHaveClass('chip-beer-ale');
});

test('beer lager-type styles get chip-beer-lager class', () => {
  const beerRows = [{ id: '1', brewery: 'Brew Co', name: 'Pint', style: 'Pilsner', country: 'CZ', abv: '5', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="beer" drinks={beerRows} />);
  expect(screen.getByText('Pilsner')).toHaveClass('chip-beer-lager');
});

test('beer stout/porter styles get chip-beer-stout class', () => {
  const beerRows = [{ id: '1', brewery: 'Brew Co', name: 'Pint', style: 'Stout', country: 'IE', abv: '5', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  render(<DrinkTable category="beer" drinks={beerRows} />);
  expect(screen.getByText('Stout')).toHaveClass('chip-beer-stout');
});

test('chip cell that is also filterable gets both classes', () => {
  const allRows = [{ id: '1', _category: 'Beer', _producer: 'Brew Co', name: 'Lager', country: 'UK', abv: '5', lastTasted: '', lastRating: '', avgRating: '', notionLink: '' }];
  const handleClick = vi.fn();
  render(<DrinkTable category="all" drinks={allRows} filterableCols={new Set(['_category'])} onCellClick={handleClick} />);
  const chip = screen.getByText('Beer');
  expect(chip).toHaveClass('chip-cat-beer');
  expect(chip).toHaveClass('cell-filterable');
  fireEvent.click(chip);
  expect(handleClick).toHaveBeenCalledWith('_category', 'Beer');
});

// ── Sorting ──────────────────────────────────────────────────────────

const SORT_ROWS = [
  { id: '1', producer: 'Zara', seriesAndName: 'Z-Wine', wineCategory: 'Red', variety: 'Merlot',
    country: 'France', region: '', abv: '14', lastTasted: '01/01/2020', lastRating: '7', avgRating: '7', notionLink: '' },
  { id: '2', producer: 'Alpha', seriesAndName: 'A-Wine', wineCategory: 'White', variety: 'Chardonnay',
    country: 'Italy', region: '', abv: '12', lastTasted: '31/12/2025', lastRating: '9', avgRating: '9', notionLink: '' },
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

test('sorting by abv uses numeric comparison: NaN→0 and valid→numeric, both branches covered', () => {
  // 3 rows so sort compares (Alpha,Zara) and (Alpha,Beta), covering parseFloat truthy AND falsy for both av and bv
  const rowsForNumericSort = [
    { ...SORT_ROWS[1], abv: '12', id: '2' },  // Alpha: parseFloat('12') = 12 (truthy)
    { ...SORT_ROWS[0], abv: '', id: '1' },     // Zara: parseFloat('') = NaN → 0 (falsy)
    { id: '3', producer: 'Beta', seriesAndName: 'B-Wine', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={rowsForNumericSort} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /abv/i }));
  const rows = screen.getAllByRole('row');
  // Ascending: 0 (Zara), 0 (Beta), 12 (Alpha) — Alpha is last
  expect(rows[rows.length - 1]).toHaveTextContent('Alpha');
});

test('columnLayout.hidden as undefined (not Set, not Array) falls back to empty Set', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: undefined };
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} />);
  expect(screen.getByRole('columnheader', { name: /producer/i })).toBeInTheDocument();
});

test('columnLayout=null treats hidden as absent and shows all columns', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={null} />);
  expect(screen.getByRole('columnheader', { name: /producer/i })).toBeInTheDocument();
});

test('columnLayout.hidden as plain array is converted to Set (Array.isArray branch)', () => {
  const layout = { order: COLUMNS.wine.map(c => c.key), hidden: ['variety'] };
  render(<DrinkTable category="wine" drinks={WINE_ROWS} columnLayout={layout} />);
  expect(screen.queryByRole('columnheader', { name: /variety/i })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /producer/i })).toBeInTheDocument();
});

test('null drink field renders as em dash', () => {
  const rowWithNull = [{ id: '1', producer: 'Test', seriesAndName: null, wineCategory: 'Red',
    variety: 'Merlot', country: 'France', region: null, abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' }];
  render(<DrinkTable category="wine" drinks={rowWithNull} />);
  const dashes = screen.getAllByText('—');
  expect(dashes.length).toBeGreaterThan(0);
});

test('renders others category columns', () => {
  const othersRows = [{ id: '1', drinkCategory: 'Rum', distillery: 'Bacardi', name: 'White Rum',
    country: 'Cuba', style: 'Light', age: '3', abv: '40', lastTasted: '', lastRating: '7', avgRating: '7', notionLink: '' }];
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
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
    { id: '1', producer: null, seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={rows} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('sort with null field: null at index 0 covers bv=null??\" \" (line 149)', () => {
  const rows = [
    { id: '1', producer: null, seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
    { id: '2', producer: 'Alpha', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
  ];
  render(<DrinkTable category="wine" drinks={rows} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /producer/i }));
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('sort by lastTasted with empty date field covers !s return 0 branch', () => {
  const rowsWithEmptyDate = [
    { id: '1', producer: 'Alpha', seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
    { id: '2', producer: 'Beta', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '01/01/2025', lastRating: '8', avgRating: '8', notionLink: '' },
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
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
    { id: '2', producer: 'Middle', seriesAndName: 'M', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
    { id: '1', producer: 'Alpha', seriesAndName: 'A', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
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
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
    { id: '2', producer: 'Same', seriesAndName: 'B', wineCategory: 'Red', variety: 'Merlot',
      country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '' },
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

test('clicking a filterable cell calls onCellClick with colKey and value', () => {
  const onCellClick = vi.fn();
  const filterableCols = new Set(['country', 'wineCategory']);
  render(<DrinkTable category="wine" drinks={WINE_ROWS} filterableCols={filterableCols} onCellClick={onCellClick} />);
  fireEvent.click(screen.getAllByText('Italy')[0]);
  expect(onCellClick).toHaveBeenCalledWith('country', 'Italy');
});

// ── Sweetness column ─────────────────────────────────────────────────

test('sweetness chip renders for wine', () => {
  const drink = [{ ...WINE_ROWS[0], sweetness: 'Dry' }];
  render(<DrinkTable category="wine" drinks={drink} />);
  expect(screen.getByText('Dry')).toBeInTheDocument();
  expect(screen.getByText('Dry')).toHaveClass('chip-sweetness-dry');
});

test('sweetness renders — when missing', () => {
  render(<DrinkTable category="wine" drinks={WINE_ROWS} />);
  const cells = screen.getAllByText('—');
  expect(cells.length).toBeGreaterThan(0);
});

test('all four sweetness values get distinct chip classes', () => {
  const values = ['Dry', 'Off-Dry', 'Sweet', 'Extra-Dry'];
  const classes = ['chip-sweetness-dry', 'chip-sweetness-offdry', 'chip-sweetness-sweet', 'chip-sweetness-extradry'];
  values.forEach((sweetness, i) => {
    const { unmount } = render(<DrinkTable category="wine" drinks={[{ ...WINE_ROWS[0], sweetness }]} />);
    expect(screen.getByText(sweetness)).toHaveClass(classes[i]);
    unmount();
  });
});

// ── Tags column ──────────────────────────────────────────────────────

const WINE_WITH_TAGS = [{ id: '1', producer: 'P', seriesAndName: 'W', wineCategory: 'Red', variety: 'Merlot',
  country: 'France', region: '', abv: '13', lastTasted: '', lastRating: '8', avgRating: '8', notionLink: '',
  tags: ['gift', 'organic'] }];

test('tags column renders pill chips for each tag', () => {
  render(<DrinkTable category="wine" drinks={WINE_WITH_TAGS} />);
  expect(screen.getByText('gift')).toBeInTheDocument();
  expect(screen.getByText('organic')).toBeInTheDocument();
});

test('tags column renders — for empty tags array', () => {
  const drink = [{ ...WINE_WITH_TAGS[0], tags: [] }];
  render(<DrinkTable category="wine" drinks={drink} />);
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('tags column renders — for missing tags field', () => {
  const drink = [{ ...WINE_WITH_TAGS[0], tags: undefined }];
  render(<DrinkTable category="wine" drinks={drink} />);
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('clicking a tag chip calls onCellClick with tags key and the specific tag', () => {
  const onCellClick = vi.fn();
  render(<DrinkTable category="wine" drinks={WINE_WITH_TAGS} filterableCols={new Set(['tags'])} onCellClick={onCellClick} />);
  fireEvent.click(screen.getByText('gift'));
  expect(onCellClick).toHaveBeenCalledWith('tags', 'gift');
});

test('tag chips have cell-filterable class when onCellClick and filterableCols provided', () => {
  render(<DrinkTable category="wine" drinks={WINE_WITH_TAGS} filterableCols={new Set(['tags'])} onCellClick={vi.fn()} />);
  expect(screen.getByText('gift')).toHaveClass('cell-filterable');
});

test('tag chips have no cell-filterable class when no onCellClick', () => {
  render(<DrinkTable category="wine" drinks={WINE_WITH_TAGS} />);
  expect(screen.getByText('gift')).not.toHaveClass('cell-filterable');
});

test('tags column appears on beer category', () => {
  const beerRow = [{ id: '1', brewery: 'B', name: 'Lager', style: 'Lager', country: 'UK',
    abv: '5', lastTasted: '', lastRating: '7', avgRating: '7', notionLink: '', tags: ['cellar'] }];
  render(<DrinkTable category="beer" drinks={beerRow} />);
  expect(screen.getByText('cellar')).toBeInTheDocument();
});

test('tags column appears on all page', () => {
  render(<DrinkTable category="all" drinks={[{ id: '1', _category: 'Wine', _producer: 'P', name: 'W', country: 'France', abv: '', lastTasted: '', lastRating: '', avgRating: '', notionLink: '', tags: ['gift'] }]} />);
  expect(screen.getByRole('columnheader', { name: /^tags$/i })).toBeInTheDocument();
});

test('tags column does not appear on collection page', () => {
  render(<DrinkTable category="collection" drinks={[{ id: '1', _category: 'Wine', _producer: 'P', name: 'W', country: 'France', abv: '', notionLink: '', tags: ['gift'] }]} />);
  expect(screen.queryByRole('columnheader', { name: /^tags$/i })).not.toBeInTheDocument();
});
