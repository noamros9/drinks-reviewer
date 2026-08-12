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

test('xKey/xLabel/xUnit generalize the axis and tooltip to a different metric (e.g. age)', () => {
  const AGE_POINTS = [{ id: '1', label: 'A X', age: 5, rating: 8 }];
  render(<AbvRatingScatter points={AGE_POINTS} onPointClick={() => {}} xKey="age" xLabel="Age at tasting" xUnit=" yrs" />);
  expect(screen.getByTestId('point-1')).toHaveAttribute('aria-label', 'A X: Age at tasting 5 yrs, rating 8');
});

test('tooltip renders the generalized xKey/xLabel/xUnit when provided', () => {
  render(<ScatterTooltip active payload={[{ payload: { label: 'A X', age: 5, rating: 8 } }]} xKey="age" xLabel="Age at tasting" xUnit=" yrs" />);
  expect(screen.getByText(/Age at tasting 5 yrs, rating 8/)).toBeInTheDocument();
});

test('pointStyle colors a point and hollow points get no fill plus an "(estimated price)" label', () => {
  const HOLLOW_POINTS = [
    { id: '1', label: 'Paid', abv: 13, rating: 8 },
    { id: '2', label: 'Estimated', abv: 5, rating: 6 },
  ];
  render(
    <AbvRatingScatter
      points={HOLLOW_POINTS} onPointClick={() => {}}
      pointStyle={p => ({ fill: p.id === '1' ? 'green' : 'red', hollow: p.id === '2' })}
    />,
  );
  const paid = screen.getByTestId('point-1');
  const estimated = screen.getByTestId('point-2');
  expect(paid).toHaveStyle({ fill: 'green' });
  expect(estimated).toHaveStyle({ fill: 'none', stroke: 'red' });
  expect(estimated).toHaveAttribute('aria-label', 'Estimated: ABV 5%, rating 6 (estimated price)');
});

test('without pointStyle, points fall back to the CSS class fill (ABV tab is unaffected)', () => {
  render(<AbvRatingScatter points={POINTS} onPointClick={() => {}} />);
  expect(screen.getByTestId('point-1')).not.toHaveAttribute('style');
});

test('medians render dashed reference lines only when numeric', () => {
  const { container, rerender } = render(<AbvRatingScatter points={POINTS} onPointClick={() => {}} />);
  expect(container.querySelectorAll('.recharts-reference-line')).toHaveLength(0);

  rerender(<AbvRatingScatter points={POINTS} onPointClick={() => {}} medians={{ x: 10, y: 7 }} />);
  expect(container.querySelectorAll('.recharts-reference-line')).toHaveLength(2);
});

test('ring draws a surface-coloured backing circle behind each mark, off by default', () => {
  const { container, rerender } = render(<AbvRatingScatter points={POINTS} onPointClick={() => {}} />);
  expect(container.querySelectorAll('circle[fill="var(--bg)"]')).toHaveLength(0);

  rerender(<AbvRatingScatter points={POINTS} onPointClick={() => {}} ring />);
  expect(container.querySelectorAll('circle[fill="var(--bg)"]')).toHaveLength(POINTS.length);
});

test('quadrantLabels render the four corner labels only when provided', () => {
  const { container, rerender } = render(<AbvRatingScatter points={POINTS} onPointClick={() => {}} />);
  expect(container.querySelectorAll('.scatter-quadrant')).toHaveLength(0);

  rerender(
    <AbvRatingScatter
      points={POINTS} onPointClick={() => {}}
      quadrantLabels={{ topLeft: 'Bargains', topRight: 'Worth It', bottomLeft: 'Skip', bottomRight: 'Overpriced' }}
    />,
  );
  expect(screen.getByText('Bargains')).toBeInTheDocument();
  expect(screen.getByText('Worth It')).toBeInTheDocument();
  expect(screen.getByText('Skip')).toBeInTheDocument();
  expect(screen.getByText('Overpriced')).toBeInTheDocument();
});

test('yKey/yDomain generalize the Y axis to a different field', () => {
  const SCORE_POINTS = [{ id: '1', label: 'A X', abv: 13, rating: 8, score: 72 }];
  render(<AbvRatingScatter points={SCORE_POINTS} onPointClick={() => {}} yKey="score" yDomain={[0, 100]} />);
  expect(screen.getByTestId('point-1')).toBeInTheDocument();
});

test('tooltip shows extraFields alongside the base label/x/rating line', () => {
  render(
    <ScatterTooltip
      active
      payload={[{ payload: { label: 'A X', abv: 13, rating: 8, weightedRating: 7.4 } }]}
      extraFields={[{ key: 'weightedRating', label: 'Weighted Rating' }]}
    />,
  );
  expect(screen.getByText(/ABV 13%, rating 8/)).toBeInTheDocument();
  expect(screen.getByText('Weighted Rating: 7.4')).toBeInTheDocument();
});
