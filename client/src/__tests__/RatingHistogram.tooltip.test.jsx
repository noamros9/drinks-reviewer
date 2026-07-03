import { render, screen } from '@testing-library/react';
import { HistogramTooltip } from '../components/RatingHistogram';

test('renders nothing when inactive', () => {
  const { container } = render(<HistogramTooltip active={false} payload={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders nothing when payload is empty', () => {
  const { container } = render(<HistogramTooltip active payload={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('pluralizes "drinks" for counts other than 1', () => {
  render(<HistogramTooltip active payload={[{ payload: { min: 7, max: 8, count: 3 } }]} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText(/drinks rated 7–8/)).toBeInTheDocument();
});

test('uses singular "drink" for a count of 1', () => {
  render(<HistogramTooltip active payload={[{ payload: { min: 7, max: 8, count: 1 } }]} />);
  expect(screen.getByText(/drink rated 7–8/)).toBeInTheDocument();
});

test('custom describe prop overrides the default text', () => {
  render(
    <HistogramTooltip
      active payload={[{ payload: { min: 4, max: 8, count: 2 } }]}
      describe={(count, min, max) => `${count === 1 ? 'drink' : 'drinks'} with ABV ${min}–${max}%`}
    />
  );
  expect(screen.getByText(/drinks with ABV 4–8%/)).toBeInTheDocument();
});
