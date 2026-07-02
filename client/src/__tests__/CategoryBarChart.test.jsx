import { render, screen, fireEvent } from '@testing-library/react';
import CategoryBarChart, { CategoryTooltip } from '../components/CategoryBarChart';

const DATA = [
  { category: 'wine', avgRating: 7.2, count: 76 },
  { category: 'beer', avgRating: 8.1, count: 59 },
  { category: 'whiskey', avgRating: 8.9, count: 18 },
  { category: 'others', avgRating: 0, count: 0 },
];

test('renders a bar per category, including a zero-count category, without throwing', () => {
  render(<CategoryBarChart data={DATA} onBarClick={() => {}} />);
  ['wine', 'beer', 'whiskey', 'others'].forEach(cat => {
    expect(screen.getByTestId(`bar-${cat}`)).toBeInTheDocument();
  });
});

test('clicking a bar fires onBarClick with the category', () => {
  const onBarClick = vi.fn();
  render(<CategoryBarChart data={DATA} onBarClick={onBarClick} />);
  fireEvent.click(screen.getByTestId('bar-wine'));
  expect(onBarClick).toHaveBeenCalledWith('wine');
});

test('bar is keyboard-activatable', () => {
  const onBarClick = vi.fn();
  render(<CategoryBarChart data={DATA} onBarClick={onBarClick} />);
  fireEvent.keyDown(screen.getByTestId('bar-beer'), { key: 'Enter' });
  expect(onBarClick).toHaveBeenCalledWith('beer');
});

test('tooltip shows "no rated drinks" for a zero-count category', () => {
  render(<CategoryTooltip active payload={[{ payload: { category: 'others', avgRating: 0, count: 0 } }]} />);
  expect(screen.getByText('Others: no rated drinks')).toBeInTheDocument();
});

test('tooltip shows the average and rated count otherwise', () => {
  render(<CategoryTooltip active payload={[{ payload: { category: 'wine', avgRating: 7.2, count: 76 } }]} />);
  expect(screen.getByText('7.2')).toBeInTheDocument();
  expect(screen.getByText(/76 rated/)).toBeInTheDocument();
});
