import { render, screen, fireEvent } from '@testing-library/react';
import DrinkTable from '../components/DrinkTable';

// ── hierarchical regions: leaf on screen, full path underneath ─────

const NESTED_ROWS = [
  { id: '1', producer: 'A', seriesAndName: 'X', country: 'Italy', region: 'Toscana / Chianti' },
  { id: '2', producer: 'B', seriesAndName: 'Y', country: 'France', region: 'Loire Valley / Sancerre' },
  { id: '3', producer: 'C', seriesAndName: 'Z', country: 'Spain', region: 'Rioja' },
];

test('region cell shows the leaf appellation, not the full path', () => {
  render(<DrinkTable category="wine" drinks={NESTED_ROWS} />);
  expect(screen.getByText('Chianti')).toBeInTheDocument();
  expect(screen.queryByText('Toscana / Chianti')).not.toBeInTheDocument();
});

test('a flat region is unchanged', () => {
  render(<DrinkTable category="wine" drinks={NESTED_ROWS} />);
  expect(screen.getByText('Rioja')).toBeInTheDocument();
});

// The leaf alone would filter to nothing, since the stored value is the full path.
test('clicking a region cell filters on the full path', () => {
  const onCellClick = vi.fn();
  render(
    <DrinkTable
      category="wine"
      drinks={NESTED_ROWS}
      onCellClick={onCellClick}
      filterableCols={new Set(['region'])}
    />
  );
  fireEvent.click(screen.getByText('Chianti'));
  expect(onCellClick).toHaveBeenCalledWith('region', 'Toscana / Chianti');
});

test('the full path stays discoverable as a tooltip', () => {
  render(
    <DrinkTable
      category="wine"
      drinks={NESTED_ROWS}
      onCellClick={vi.fn()}
      filterableCols={new Set(['region'])}
    />
  );
  expect(screen.getByText('Chianti')).toHaveAttribute('title', 'Toscana / Chianti');
});

test('sorting by region orders by the displayed leaf, not the hidden path', () => {
  render(<DrinkTable category="wine" drinks={NESTED_ROWS} />);
  fireEvent.click(screen.getByRole('columnheader', { name: /region/i }));
  const cells = screen.getAllByRole('row').slice(1).map(r => r.textContent);
  // leaves are Chianti / Sancerre / Rioja -> C, R, S (by full path it would be L, R, T)
  expect(cells[0]).toContain('Chianti');
  expect(cells[1]).toContain('Rioja');
  expect(cells[2]).toContain('Sancerre');
});
