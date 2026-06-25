import { render, screen, fireEvent } from '@testing-library/react';
import AbvFilter from '../components/AbvFilter';

function renderAbv(abvMin = '', abvMax = '', onChange = vi.fn()) {
  render(<AbvFilter abvMin={abvMin} abvMax={abvMax} onChange={onChange} />);
  return onChange;
}

function openPanel() {
  fireEvent.click(screen.getByTestId('filter-abv'));
}

test('renders pill button with label "ABV"', () => {
  renderAbv();
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV');
});

test('button is not active when no values set', () => {
  renderAbv();
  expect(screen.getByTestId('filter-abv')).not.toHaveClass('active');
});

test('button is active and shows range when min is set', () => {
  renderAbv('8', '');
  expect(screen.getByTestId('filter-abv')).toHaveClass('active');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV 8–∞%');
});

test('button shows both bounds when both set', () => {
  renderAbv('8', '14');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV 8–14%');
});

test('opens panel with min/max inputs on click', () => {
  renderAbv();
  openPanel();
  expect(screen.getByTestId('abv-min')).toBeInTheDocument();
  expect(screen.getByTestId('abv-max')).toBeInTheDocument();
});

test('changing min input calls onChange', () => {
  const onChange = renderAbv('', '');
  openPanel();
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '10' } });
  expect(onChange).toHaveBeenCalledWith({ abvMin: '10', abvMax: '' });
});

test('clear button calls onChange with empty strings', () => {
  const onChange = renderAbv('8', '14');
  openPanel();
  fireEvent.click(screen.getByText('Clear filter'));
  expect(onChange).toHaveBeenCalledWith({ abvMin: '', abvMax: '' });
});

test('clear button not shown when no values set', () => {
  renderAbv();
  openPanel();
  expect(screen.queryByText('Clear filter')).not.toBeInTheDocument();
});

test('shows range with only max set', () => {
  renderAbv('', '14');
  expect(screen.getByTestId('filter-abv')).toHaveTextContent('ABV 0–14%');
});

test('mousedown outside closes the panel', () => {
  renderAbv();
  openPanel();
  expect(screen.getByTestId('abv-min')).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByTestId('abv-min')).not.toBeInTheDocument();
});

test('changing max input calls onChange', () => {
  const onChange = renderAbv('', '');
  openPanel();
  fireEvent.change(screen.getByTestId('abv-max'), { target: { value: '14' } });
  expect(onChange).toHaveBeenCalledWith({ abvMin: '', abvMax: '14' });
});
