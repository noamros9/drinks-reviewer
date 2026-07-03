import { render, screen, fireEvent } from '@testing-library/react';
import AbvRatingScatter, { ScatterTooltip } from '../components/AbvRatingScatter';

const POINTS = [
  { id: '1', label: 'A X', abv: 13, rating: 8 },
  { id: '2', label: 'B Y', abv: 5.5, rating: 6 },
];

test('renders one point per input', () => {
  render(<AbvRatingScatter points={POINTS} onPointClick={() => {}} />);
  expect(screen.getByTestId('point-1')).toBeInTheDocument();
  expect(screen.getByTestId('point-2')).toBeInTheDocument();
});

test('clicking a point fires onPointClick with that point\'s data', () => {
  const onPointClick = vi.fn();
  render(<AbvRatingScatter points={POINTS} onPointClick={onPointClick} />);
  fireEvent.click(screen.getByTestId('point-1'));
  expect(onPointClick).toHaveBeenCalledWith(POINTS[0]);
});

test('point is keyboard-activatable', () => {
  const onPointClick = vi.fn();
  render(<AbvRatingScatter points={POINTS} onPointClick={onPointClick} />);
  fireEvent.keyDown(screen.getByTestId('point-2'), { key: 'Enter' });
  expect(onPointClick).toHaveBeenCalledWith(POINTS[1]);
});

test('tooltip renders label/abv/rating when active', () => {
  render(<ScatterTooltip active payload={[{ payload: { label: 'A X', abv: 13, rating: 8 } }]} />);
  expect(screen.getByText('A X')).toBeInTheDocument();
  expect(screen.getByText(/ABV 13%, rating 8/)).toBeInTheDocument();
});

test('tooltip renders nothing when inactive or payload is empty', () => {
  const { container: c1 } = render(<ScatterTooltip active={false} payload={[]} />);
  expect(c1).toBeEmptyDOMElement();
  const { container: c2 } = render(<ScatterTooltip active payload={[]} />);
  expect(c2).toBeEmptyDOMElement();
});
