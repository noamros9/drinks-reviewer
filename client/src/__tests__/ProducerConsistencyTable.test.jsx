import { render, screen, fireEvent } from '@testing-library/react';
import ProducerConsistencyTable from '../pages/analytics/ProducerConsistencyTable';

const STEADY = { producer: 'Chateau', stdDev: 0, count: 2 };
const WILD = { producer: 'Winery', stdDev: 3, count: 2 };

test('renders both lists with their entries', () => {
  render(<ProducerConsistencyTable data={{ mostConsistent: [STEADY], leastConsistent: [WILD] }} onSelectProducer={() => {}} />);
  expect(screen.getByText('Most Consistent')).toBeInTheDocument();
  expect(screen.getByText('Least Consistent')).toBeInTheDocument();
  expect(screen.getByText('Chateau')).toBeInTheDocument();
  expect(screen.getByText('0.00')).toBeInTheDocument();
  expect(screen.getByText('Winery')).toBeInTheDocument();
  expect(screen.getByText('3.00')).toBeInTheDocument();
});

test('shows an empty-pool message when there are no qualifying producers', () => {
  render(<ProducerConsistencyTable data={{ mostConsistent: [], leastConsistent: [] }} onSelectProducer={() => {}} />);
  expect(screen.getAllByText('No producers with more than one drink yet.')).toHaveLength(2);
});

test('clicking a producer name fires onSelectProducer with that producer', () => {
  const onSelectProducer = vi.fn();
  render(<ProducerConsistencyTable data={{ mostConsistent: [STEADY], leastConsistent: [WILD] }} onSelectProducer={onSelectProducer} />);
  fireEvent.click(screen.getByText('Chateau'));
  expect(onSelectProducer).toHaveBeenCalledWith('Chateau');
});
