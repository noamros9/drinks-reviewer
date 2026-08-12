import { render, screen, within } from '@testing-library/react';
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

test('defaults to the global category and shows the tasted-drink count', () => {
  renderSection('all');
  expect(screen.getByText('2 tasted drinks')).toBeInTheDocument();
});

test('follows the global category', () => {
  renderSection('wine');
  expect(screen.getByText('1 tasted drink')).toBeInTheDocument();
});

test('category trend always shows all 4 category legend labels regardless of scope', () => {
  const { container } = renderSection('wine');
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
