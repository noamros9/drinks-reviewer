import { render, screen, fireEvent } from '@testing-library/react';
import RangeFilter from '../components/RangeFilter';

const ABV_CONFIG = { key: 'abv', label: 'ABV', unit: '%', min: 0, max: 100, step: 0.1, unbounded: true };
const RATING_CONFIG = { key: 'avgRating', label: 'Avg Rating', unit: '', min: 1, max: 10, step: 0.5 };

function renderRange(config = ABV_CONFIG, min = '', max = '', onChange = vi.fn()) {
  render(<RangeFilter config={config} min={min} max={max} onChange={onChange} />);
  return onChange;
}

function openPanel(config = ABV_CONFIG) {
  fireEvent.click(screen.getByTestId(`filter-${config.key}`));
}

test('renders pill button with the config label', () => {
  renderRange();
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV');
});

test('button is not active when no values set', () => {
  renderRange();
  expect(screen.getByTestId('filter-abv')).not.toHaveClass('active');
});

test('button is active and shows range when min is set', () => {
  renderRange(ABV_CONFIG, '8', '');
  expect(screen.getByTestId('filter-abv')).toHaveClass('active');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV 8–∞%');
});

test('button shows both bounds when both set', () => {
  renderRange(ABV_CONFIG, '8', '14');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV 8–14%');
});

test('opens panel with min/max inputs on click', () => {
  renderRange();
  openPanel();
  expect(screen.getByTestId('abv-min')).toBeInTheDocument();
  expect(screen.getByTestId('abv-max')).toBeInTheDocument();
});

test('changing min input calls onChange with (min, max)', () => {
  const onChange = renderRange();
  openPanel();
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '10' } });
  expect(onChange).toHaveBeenCalledWith('10', '');
});

test('changing max input calls onChange with (min, max)', () => {
  const onChange = renderRange();
  openPanel();
  fireEvent.change(screen.getByTestId('abv-max'), { target: { value: '14' } });
  expect(onChange).toHaveBeenCalledWith('', '14');
});

test('clear button calls onChange with empty strings', () => {
  const onChange = renderRange(ABV_CONFIG, '8', '14');
  openPanel();
  fireEvent.click(screen.getByText('Clear filter'));
  expect(onChange).toHaveBeenCalledWith('', '');
});

test('clear button not shown when no values set', () => {
  renderRange();
  openPanel();
  expect(screen.queryByText('Clear filter')).not.toBeInTheDocument();
});

test('shows range with only max set, falls back to config.min for missing min', () => {
  renderRange(ABV_CONFIG, '', '14');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV 0–14%');
});

test('mousedown outside closes the panel', () => {
  renderRange();
  openPanel();
  expect(screen.getByTestId('abv-min')).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByTestId('abv-min')).not.toBeInTheDocument();
});

test('unbounded config falls back to ∞ for missing max', () => {
  renderRange(ABV_CONFIG, '8', '');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('8–∞');
});

test('bounded config (no unit) falls back to config.max for missing max', () => {
  renderRange(RATING_CONFIG, '7', '');
  expect(screen.getByTestId('filter-avgRating')).toHaveTextContent('Avg Rating 7–10');
});

test('bounded config max input placeholder is config.max, not ∞', () => {
  renderRange(RATING_CONFIG);
  fireEvent.click(screen.getByTestId('filter-avgRating'));
  expect(screen.getByTestId('avgRating-max')).toHaveAttribute('placeholder', '10');
});

test('config with empty unit renders no unit span', () => {
  renderRange(RATING_CONFIG, '7', '9');
  expect(screen.getByTestId('filter-avgRating')).toHaveTextContent('Avg Rating 7–9');
  expect(screen.getByTestId('filter-avgRating')).not.toHaveTextContent('%');
});

test('adds alignRight modifier class when menu overflows the right edge', () => {
  const getRectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ right: window.innerWidth + 50 });
  renderRange();
  openPanel();
  expect(document.querySelector('.filter-dropdown-menu--right')).toBeInTheDocument();
  getRectSpy.mockRestore();
});

test('does not add alignRight modifier class when menu fits on screen', () => {
  const getRectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ right: window.innerWidth - 50 });
  renderRange();
  openPanel();
  expect(document.querySelector('.filter-dropdown-menu--right')).not.toBeInTheDocument();
  getRectSpy.mockRestore();
});
