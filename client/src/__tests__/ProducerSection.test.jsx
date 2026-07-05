import { render, screen, fireEvent, within } from '@testing-library/react';
import ProducerSection from '../pages/analytics/ProducerSection';

const DRINKS = [
  { id: 'w1', _category: 'wine', producer: 'Chateau', avgRating: 8 },
  { id: 'w2', _category: 'wine', producer: 'Chateau', avgRating: 6 },
  { id: 'w3', _category: 'wine', producer: 'Winery', avgRating: 9 },
  { id: 'b1', _category: 'beer', brewery: 'Alexander', avgRating: 9 },
  { id: 'b2', _category: 'beer', brewery: 'Alexander', avgRating: 8 },
  { id: 'k1', _category: 'whiskey', distillery: 'Glendronach', avgRating: 9 },
  // no 'others' drinks -> that block should be empty
];

beforeEach(() => {
  vi.spyOn(window, 'open').mockImplementation(() => {});
});
afterEach(() => {
  window.open.mockRestore();
});

const render_ = (globalCategory = 'all') =>
  render(<ProducerSection drinks={DRINKS} globalCategory={globalCategory} />);

const scope = () => within(screen.getByTestId('producer-category-filter'));

test('under All scope, renders a block per category', () => {
  render_('all');
  expect(screen.getByText('Wine — producers')).toBeInTheDocument();
  expect(screen.getByText('Beer — breweries')).toBeInTheDocument();
  expect(screen.getByText('Whiskey — distilleries')).toBeInTheDocument();
  expect(screen.getByText('Others — distilleries')).toBeInTheDocument();
});

test('a non-All global category shows only that block', () => {
  render_('beer');
  expect(screen.getByText('Beer — breweries')).toBeInTheDocument();
  expect(screen.queryByText('Wine — producers')).not.toBeInTheDocument();
});

test('the local scope filter overrides the global category', () => {
  render_('all');
  fireEvent.click(scope().getByRole('button', { name: 'Whiskey' }));
  expect(screen.getByText('Whiskey — distilleries')).toBeInTheDocument();
  expect(screen.queryByText('Beer — breweries')).not.toBeInTheDocument();
});

test('a category with no drinks shows an empty leaderboard state', () => {
  render_('others');
  expect(screen.getByText('No producer data yet.')).toBeInTheDocument();
});

test('leaderboard row click deep-links to the filtered category page by producer', () => {
  render_('wine');
  fireEvent.click(within(screen.getByTestId('style-leaderboard-table')).getByText('Chateau'));
  expect(window.open).toHaveBeenCalledWith('/wine?producer=Chateau', '_blank');
});

test('non-wine leaderboard row click deep-links by producer too', () => {
  render_('beer');
  fireEvent.click(within(screen.getByTestId('style-leaderboard-table')).getByText('Alexander'));
  expect(window.open).toHaveBeenCalledWith('/beer?producer=Alexander', '_blank');
});

test('consistency table shows only the qualifying (>=2 drinks) producer', () => {
  const { container } = render_('wine');
  const consistency = within(container.querySelector('.consistency-leaderboard'));
  expect(consistency.getByText('Most Consistent')).toBeInTheDocument();
  expect(consistency.getByText('Least Consistent')).toBeInTheDocument();
  expect(consistency.getAllByText('Chateau').length).toBeGreaterThan(0);
  expect(consistency.queryByText('Winery')).not.toBeInTheDocument(); // only 1 drink, excluded
});

test('consistency row click also deep-links to the filtered category page', () => {
  render_('wine');
  const consistencyLinks = screen.getAllByText('Chateau').filter(el => el.tagName === 'BUTTON');
  fireEvent.click(consistencyLinks[0]);
  expect(window.open).toHaveBeenCalledWith('/wine?producer=Chateau', '_blank');
});

test('shows the consistency empty state when no producer has >= 2 drinks', () => {
  render(<ProducerSection drinks={[{ id: 'x', _category: 'beer', brewery: 'Solo', avgRating: 8 }]} globalCategory="beer" />);
  expect(screen.getAllByText('No producers with more than one drink yet.').length).toBe(2);
});
