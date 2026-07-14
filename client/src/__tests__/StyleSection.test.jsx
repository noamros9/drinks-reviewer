import { render, screen, fireEvent, within } from '@testing-library/react';
import StyleSection from '../pages/analytics/StyleSection';

const DRINKS = [
  { id: 'w1', _category: 'wine', variety: ['Merlot'], avgRating: 9 },
  { id: 'w2', _category: 'wine', variety: ['Cabernet Sauvignon', 'Merlot'], avgRating: 6 },
  { id: 'w3', _category: 'wine', variety: ['Riesling'], avgRating: 9, },
  { id: 'b1', _category: 'beer', style: 'IPA', avgRating: 8.5 },
  { id: 'b2', _category: 'beer', style: 'IPA', avgRating: 8 },
  { id: 'k1', _category: 'whiskey', style: 'Single Malt', avgRating: 9 },
  // no 'others' drinks -> that block should be empty
];

beforeEach(() => {
  vi.spyOn(window, 'open').mockImplementation(() => {});
});
afterEach(() => {
  window.open.mockRestore();
});

const render_ = (globalCategory = 'all') =>
  render(<StyleSection drinks={DRINKS} globalCategory={globalCategory} />);

const scope = () => within(screen.getByTestId('style-category-filter'));

test('under All scope, renders a block per category', () => {
  render_('all');
  expect(screen.getByText('Wine — varieties')).toBeInTheDocument();
  expect(screen.getByText('Beer — styles')).toBeInTheDocument();
  expect(screen.getByText('Whiskey — styles')).toBeInTheDocument();
  expect(screen.getByText('Others — styles')).toBeInTheDocument();
});

test('a non-All global category shows only that block', () => {
  render_('beer');
  expect(screen.getByText('Beer — styles')).toBeInTheDocument();
  expect(screen.queryByText('Wine — varieties')).not.toBeInTheDocument();
});

test('the local scope filter overrides the global category', () => {
  render_('all');
  fireEvent.click(scope().getByRole('button', { name: 'Whiskey' }));
  expect(screen.getByText('Whiskey — styles')).toBeInTheDocument();
  expect(screen.queryByText('Beer — styles')).not.toBeInTheDocument();
});

test('a category with no drinks shows an empty table state', () => {
  render_('others');
  expect(screen.getByText('No style data yet.')).toBeInTheDocument();
});

test('wine defaults to grape mode: blends are split into constituent grapes', () => {
  render_('wine');
  // Merlot appears in w1 + the w2 blend -> count 2
  const table = within(screen.getByTestId('style-leaderboard-table'));
  expect(table.getByText('Merlot')).toBeInTheDocument();
  expect(table.getByText('Cabernet Sauvignon')).toBeInTheDocument();
  expect(table.queryByText('Cabernet Sauvignon, Merlot')).not.toBeInTheDocument();
});

test('toggling to By blend keeps the whole variety string', () => {
  render_('wine');
  fireEvent.click(within(screen.getByTestId('wine-blend-toggle')).getByRole('button', { name: 'By blend' }));
  const table = within(screen.getByTestId('style-leaderboard-table'));
  expect(table.getByText('Cabernet Sauvignon, Merlot')).toBeInTheDocument();
});

test('grape mode row click deep-links to the filtered wine page by variety', () => {
  render_('wine');
  fireEvent.click(within(screen.getByTestId('style-leaderboard-table')).getByText('Merlot'));
  expect(window.open).toHaveBeenCalledWith('/wine?variety=Merlot', '_blank');
});

test('blend mode is display-only: clicking a row does not open a tab', () => {
  render_('wine');
  fireEvent.click(within(screen.getByTestId('wine-blend-toggle')).getByRole('button', { name: 'By blend' }));
  fireEvent.click(within(screen.getByTestId('style-leaderboard-table')).getByText('Riesling'));
  expect(window.open).not.toHaveBeenCalled();
});

test('non-wine row click deep-links by style', () => {
  render_('beer');
  fireEvent.click(within(screen.getByTestId('style-leaderboard-table')).getByText('IPA'));
  expect(window.open).toHaveBeenCalledWith('/beer?style=IPA', '_blank');
});

test('undiscovered list surfaces high-rated, low-count styles', () => {
  const { container } = render_('wine');
  // Riesling: avg 9, count 1 -> undiscovered
  const list = container.querySelector('.style-undiscovered-list');
  expect(within(list).getByText('Riesling')).toBeInTheDocument();
});

test('shows the undiscovered empty state when nothing qualifies', () => {
  render(<StyleSection drinks={[{ id: 'b1', _category: 'beer', style: 'IPA', avgRating: 5 }]} globalCategory="beer" />);
  expect(screen.getByText('Nothing undiscovered here.')).toBeInTheDocument();
});
