import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '../components/FilterBar';
import { buildInitialFilters } from '../utils/filterHelpers';

const WINES = [
  { id: '1', producer: 'Citra', wineCategory: 'Red', variety: ['Sangiovese'], country: 'Italy', region: 'Abruzzo' },
];

function renderBar(overrides = {}) {
  const activeFilters = { ...buildInitialFilters('wine'), ...overrides };
  const onChange = vi.fn();
  render(<FilterBar category="wine" drinks={WINES} activeFilters={activeFilters} onChange={onChange} />);
  return { onChange };
}

test('filter-toggle button always renders', () => {
  renderBar();
  expect(screen.getByTestId('filter-toggle')).toBeInTheDocument();
});

test('filter-bar does not have filters-open class initially', () => {
  renderBar();
  expect(document.querySelector('.filter-bar')).not.toHaveClass('filters-open');
});

test('clicking filter-toggle adds filters-open class to filter-bar', () => {
  renderBar();
  fireEvent.click(screen.getByTestId('filter-toggle'));
  expect(document.querySelector('.filter-bar')).toHaveClass('filters-open');
});

test('clicking filter-toggle again removes filters-open class', () => {
  renderBar();
  const toggle = screen.getByTestId('filter-toggle');
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(document.querySelector('.filter-bar')).not.toHaveClass('filters-open');
});

test('toggle button shows ▾ when closed', () => {
  renderBar();
  expect(screen.getByTestId('filter-toggle')).toHaveTextContent('▾');
});

test('toggle button shows ▴ when open', () => {
  renderBar();
  fireEvent.click(screen.getByTestId('filter-toggle'));
  expect(screen.getByTestId('filter-toggle')).toHaveTextContent('▴');
});

test('active count shows in toggle when producerSearch is set', () => {
  renderBar({ producerSearch: 'Citra' });
  expect(screen.getByTestId('filter-toggle')).toHaveTextContent('Filters (1)');
});

test('active count includes dropdown selections', () => {
  renderBar({ wineCategory: new Set(['Red', 'White']) });
  expect(screen.getByTestId('filter-toggle')).toHaveTextContent('Filters (2)');
});

test('active count includes ABV filter as 1', () => {
  renderBar({ abvMin: '12', abvMax: '15' });
  expect(screen.getByTestId('filter-toggle')).toHaveTextContent('Filters (1)');
});

test('active count sums all filter types', () => {
  renderBar({ producerSearch: 'Citra', wineCategory: new Set(['Red']), abvMin: '12' });
  expect(screen.getByTestId('filter-toggle')).toHaveTextContent('Filters (3)');
});

test('no count shown when no filters active', () => {
  renderBar();
  const toggle = screen.getByTestId('filter-toggle');
  expect(toggle.textContent).not.toMatch(/\(\d+\)/);
});
