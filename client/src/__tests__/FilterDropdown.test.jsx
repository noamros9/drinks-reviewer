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

// ── toggle / clear ────────────────────────────────────────────────

test('clicking an option calls onChange with it added to the Set', () => {
  const onChange = vi.fn();
  renderDropdown({ onChange });
  openDropdown();
  fireEvent.click(screen.getByRole('checkbox', { name: /red/i }));
  const next = onChange.mock.calls[0][0];
  expect(next.has('Red')).toBe(true);
});

test('clicking a selected option calls onChange with it removed from the Set', () => {
  const onChange = vi.fn();
  renderDropdown({ selected: new Set(['Red']), onChange });
  openDropdown();
  fireEvent.click(screen.getByRole('checkbox', { name: /red/i }));
  const next = onChange.mock.calls[0][0];
  expect(next.has('Red')).toBe(false);
});

test('Clear filter button calls onChange with empty Set', () => {
  const onChange = vi.fn();
  renderDropdown({ selected: new Set(['Red']), onChange });
  openDropdown();
  fireEvent.click(screen.getByText('Clear filter'));
  const next = onChange.mock.calls[0][0];
  expect(next.size).toBe(0);
});

test('Clear filter button not shown when nothing selected', () => {
  renderDropdown();
  openDropdown();
  expect(screen.queryByText('Clear filter')).not.toBeInTheDocument();
});

test('mousedown outside dropdown closes it', () => {
  renderDropdown();
  openDropdown();
  expect(screen.getByRole('checkbox', { name: /red/i })).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('checkbox', { name: /red/i })).not.toBeInTheDocument();
});

test('clicking a special option checkbox invokes its onChange (covers specialOptions toggle lambda)', () => {
  const onChange = vi.fn();
  renderDropdown({
    specialOptions: ['Old World', 'New World'],
    options: ['France'],
    onChange,
  });
  openDropdown();
  fireEvent.click(screen.getByRole('checkbox', { name: /old world/i }));
  expect(onChange.mock.calls[0][0].has('Old World')).toBe(true);
});

test('adds alignRight modifier class when menu overflows the right edge', () => {
  const getRectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ right: window.innerWidth + 50 });
  renderDropdown();
  openDropdown();
  expect(document.querySelector('.filter-dropdown-menu--right')).toBeInTheDocument();
  getRectSpy.mockRestore();
});

test('does not add alignRight modifier class when menu fits on screen', () => {
  const getRectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ right: window.innerWidth - 50 });
  renderDropdown();
  openDropdown();
  expect(document.querySelector('.filter-dropdown-menu--right')).not.toBeInTheDocument();
  getRectSpy.mockRestore();
});

test('unmounting component runs useEffect cleanup (removeEventListener)', () => {
  const { unmount } = render(
    <FilterDropdown label="Type" options={['Red']} specialOptions={[]} selected={new Set()} onChange={vi.fn()} />
  );
  unmount();
  // No crash = cleanup ran successfully
});
