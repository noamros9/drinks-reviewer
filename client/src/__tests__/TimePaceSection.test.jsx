import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimePaceSection from '../pages/analytics/TimePaceSection';

const DRINKS = [
  { id: 'w1', _category: 'wine', tastings: [{ date: '10/01/2025' }] },
  { id: 'b1', _category: 'beer', tastings: [{ date: '15/02/2025' }] },
  { id: 'k1', _category: 'whiskey', tastings: [] },
  { id: 'o1', _category: 'others' },
];

function renderSection(globalCategory = 'all') {
  return render(
    <MemoryRouter>
      <TimePaceSection drinks={DRINKS} globalCategory={globalCategory} />
    </MemoryRouter>
  );
}

function scopeFilter() {
  return within(screen.getByTestId('timepace-category-filter'));
}

test('defaults to the global category and shows the tasted-drink count', () => {
  renderSection('all');
  expect(screen.getByText('2 tasted drinks')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'All' })).toHaveClass('active');
});

test('follows a non-All global category when no local override has been made', () => {
  renderSection('wine');
  expect(screen.getByText('1 tasted drink')).toBeInTheDocument();
});

test('clicking the local scope filter overrides the global category', () => {
  renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('1 tasted drink')).toBeInTheDocument();
  expect(scopeFilter().getByRole('button', { name: 'Beer' })).toHaveClass('active');
});

test('category trend always shows all 4 category legend labels regardless of scope', () => {
  const { container } = renderSection('all');
  fireEvent.click(scopeFilter().getByRole('button', { name: 'Wine' }));
  const legend = within(container.querySelector('.recharts-legend-wrapper'));
  ['Wine', 'Beer', 'Whiskey', 'Others'].forEach(label => {
    expect(legend.getByText(label)).toBeInTheDocument();
  });
});

test('shows empty state when nothing has been tasted', () => {
  const untasted = DRINKS.map(({ tastings, ...rest }) => rest);
  render(
    <MemoryRouter>
      <TimePaceSection drinks={untasted} globalCategory="all" />
    </MemoryRouter>
  );
  expect(screen.getByText('No tastings logged yet.')).toBeInTheDocument();
});
