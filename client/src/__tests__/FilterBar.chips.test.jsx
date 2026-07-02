import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters } from '../utils/filterHelpers';

const WINES = [
  { id: '1', producer: 'Citra',    wineCategory: 'Red',   variety: 'Sangiovese', country: 'Italy',  region: 'Abruzzo' },
  { id: '2', producer: 'ChateauX', wineCategory: 'White', variety: 'Chardonnay', country: 'France', region: 'Bordeaux' },
];

function renderBar(overrides = {}, category = 'wine') {
  const activeFilters = { ...buildInitialFilters(category), ...overrides };
  const onChange = vi.fn();
  render(<FilterBar category={category} drinks={WINES} activeFilters={activeFilters} onChange={onChange} />);
  return { onChange };
}

test('no chips when no filters active', () => {
  renderBar();
  expect(document.querySelector('.filter-chips')).not.toBeInTheDocument();
});

test('producer chip appears when producerSearch set', () => {
  renderBar({ producerSearch: 'Citra' });
  expect(screen.getByText(/producer: citra/i)).toBeInTheDocument();
});

test('clicking × on producer chip clears producerSearch', () => {
  const { onChange } = renderBar({ producerSearch: 'Citra' });
  fireEvent.click(screen.getByLabelText('Remove producer filter'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ producerSearch: '' }));
});

test('dropdown value chip appears when filter value selected', () => {
  renderBar({ wineCategory: new Set(['Red']) });
  expect(screen.getByText('Red')).toBeInTheDocument();
});

test('clicking × on dropdown chip removes only that value', () => {
  const { onChange } = renderBar({ wineCategory: new Set(['Red', 'White']) });
  fireEvent.click(screen.getByLabelText('Remove Red filter'));
  const updated = onChange.mock.calls[0][0].wineCategory;
  expect(updated.has('Red')).toBe(false);
  expect(updated.has('White')).toBe(true);
});

test('multiple chips from same dropdown all render', () => {
  renderBar({ country: new Set(['France', 'Italy']) });
  expect(screen.getByText('France')).toBeInTheDocument();
  expect(screen.getByText('Italy')).toBeInTheDocument();
});

test('ABV chip appears when abvMin set', () => {
  renderBar({ abvMin: '12' });
  expect(screen.getByText('ABV: 12–∞')).toBeInTheDocument();
});

test('ABV chip appears when abvMax set', () => {
  renderBar({ abvMax: '15' });
  expect(screen.getByText('ABV: 0–15')).toBeInTheDocument();
});

test('ABV chip appears when both abvMin and abvMax set', () => {
  renderBar({ abvMin: '12', abvMax: '15' });
  expect(screen.getByText('ABV: 12–15')).toBeInTheDocument();
});

test('clicking × on ABV chip clears both abvMin and abvMax', () => {
  const { onChange } = renderBar({ abvMin: '12', abvMax: '15' });
  fireEvent.click(screen.getByLabelText('Remove ABV filter'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ abvMin: '', abvMax: '' }));
});

test('ABV chip appears when abvMin is "0"', () => {
  renderBar({ abvMin: '0' });
  expect(screen.getByText('ABV: 0–∞')).toBeInTheDocument();
});

test('Avg Rating chip appears when avgRatingMin set, with bounded max fallback', () => {
  renderBar({ avgRatingMin: '7' });
  expect(screen.getByText('Avg Rating: 7–10')).toBeInTheDocument();
});

test('clicking × on Avg Rating chip clears both avgRatingMin and avgRatingMax', () => {
  const { onChange } = renderBar({ avgRatingMin: '7', avgRatingMax: '9' });
  fireEvent.click(screen.getByLabelText('Remove Avg Rating filter'));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ avgRatingMin: '', avgRatingMax: '' }));
});

test('Vivino filter is available on wine', () => {
  renderBar({}, 'wine');
  expect(screen.getByTestId('filter-vivinoScore')).toBeInTheDocument();
});

test('Vivino filter is not available on beer', () => {
  renderBar({}, 'beer');
  expect(screen.queryByTestId('filter-vivinoScore')).not.toBeInTheDocument();
});

test('Vivino chip appears when vivinoScoreMin set on wine, with bounded max fallback', () => {
  renderBar({ vivinoScoreMin: '4' }, 'wine');
  expect(screen.getByText('Vivino: 4–5')).toBeInTheDocument();
});

test('chips from multiple filter types all render together', () => {
  renderBar({ producerSearch: 'Citra', wineCategory: new Set(['Red']), abvMin: '12' });
  expect(screen.getByText(/producer: citra/i)).toBeInTheDocument();
  expect(screen.getByText('Red')).toBeInTheDocument();
  expect(screen.getByText('ABV: 12–∞')).toBeInTheDocument();
});
