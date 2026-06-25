import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryCard from '../components/CategoryCard';

test('shows "entry" (singular) for count of 1', () => {
  render(<MemoryRouter><CategoryCard category="wine" count={1} /></MemoryRouter>);
  expect(screen.getByText('1 entry')).toBeInTheDocument();
});

test('shows "entries" (plural) for count > 1', () => {
  render(<MemoryRouter><CategoryCard category="wine" count={5} /></MemoryRouter>);
  expect(screen.getByText('5 entries')).toBeInTheDocument();
});

test('renders the correct icon and label for each category', () => {
  const { rerender } = render(<MemoryRouter><CategoryCard category="beer" count={0} /></MemoryRouter>);
  expect(screen.getByText('Beer')).toBeInTheDocument();
  rerender(<MemoryRouter><CategoryCard category="whiskey" count={0} /></MemoryRouter>);
  expect(screen.getByText('Whiskey')).toBeInTheDocument();
});
