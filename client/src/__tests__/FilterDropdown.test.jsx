import { render, screen, fireEvent } from '@testing-library/react';
import FilterDropdown from '../components/FilterDropdown';

function renderDropdown(overrides = {}) {
  const defaults = {
    label: 'Type',
    options: ['Red', 'White', 'Rosé'],
    specialOptions: [],
    selected: new Set(),
    counts: {},
    onChange: vi.fn(),
  };
  render(<FilterDropdown {...defaults} {...overrides} />);
}

function openDropdown(label = 'Type') {
  fireEvent.click(screen.getByTestId(`filter-dropdown-${label.toLowerCase()}`));
}

test('renders button with label', () => {
  renderDropdown();
  expect(screen.getByTestId('filter-dropdown-type')).toBeInTheDocument();
});

test('shows counts next to options when counts prop is provided', () => {
  renderDropdown({ counts: { Red: 5, White: 3 } });
  openDropdown();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
});

test('shows counts for special options', () => {
  renderDropdown({
    specialOptions: ['Old World', 'New World'],
    options: ['France'],
    counts: { 'Old World': 12, 'New World': 4, 'France': 7 },
  });
  openDropdown();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('does not render count elements when counts prop is empty', () => {
  renderDropdown({ counts: {} });
  openDropdown();
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.filter-option-count')).toHaveLength(0);
});

test('does not render count elements when counts prop is omitted', () => {
  renderDropdown();
  openDropdown();
  expect(document.querySelectorAll('.filter-option-count')).toHaveLength(0);
});
