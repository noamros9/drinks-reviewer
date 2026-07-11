import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionPage from '../pages/CollectionPage';

const LOT = { id: 'lot1', quantity: 2, price: 45, addedAt: '2026-01-01' };
const WINE = { id: 'w1', _category: 'wine', producer: 'Château X', seriesAndName: 'Grand Cru', country: 'France', abv: '13', avgRating: '9', collection: [LOT] };
const BEER = { id: 'b1', _category: 'beer', brewery: 'Brew Co', name: 'Pale Ale', country: 'UK', abv: '5', avgRating: '3', collection: [LOT] };
const WHISKEY = { id: 'k1', _category: 'whiskey', distillery: 'Lagavulin', name: 'Special', country: 'Scotland', abv: '43', avgRating: '8', collection: [LOT] };
const OTHERS = { id: 'x1', _category: 'others', producer: 'Mystery Co', name: 'Mystery Drink', country: 'Japan', abv: '20', avgRating: '5', collection: [LOT] };

function mockFetch(data = [WINE, BEER, WHISKEY, OTHERS]) {
  global.fetch = vi.fn((url, opts) => {
    if (!opts) return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(LOT) });
  });
}

beforeEach(() => mockFetch());

test('all category tabs are rendered', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  ['All', 'Wine', 'Beer', 'Whiskey', 'Others'].forEach(label => {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});

test('All tab is active by default', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByRole('button', { name: 'All' })).toHaveClass('active');
});

test('clicking Wine tab shows only wine entries and marks it active', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  expect(screen.getByRole('button', { name: 'Wine' })).toHaveClass('active');
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
  expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  expect(screen.queryByText('Special')).not.toBeInTheDocument();
  expect(screen.queryByText('Mystery Drink')).not.toBeInTheDocument();
});

test('clicking Beer tab shows only beer entries', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Beer' }));
  expect(screen.getByText('Pale Ale')).toBeInTheDocument();
  expect(screen.queryByText('Grand Cru')).not.toBeInTheDocument();
});

test('clicking Whiskey tab shows only whiskey entries', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Whiskey' }));
  expect(screen.getByText('Special')).toBeInTheDocument();
  expect(screen.queryByText('Grand Cru')).not.toBeInTheDocument();
});

test('clicking Others tab shows only others entries', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Others' }));
  expect(screen.getByText('Mystery Drink')).toBeInTheDocument();
  expect(screen.queryByText('Grand Cru')).not.toBeInTheDocument();
});

test('clicking All again restores the full list', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(screen.getByText('Pale Ale')).toBeInTheDocument();
  expect(screen.getByText('Special')).toBeInTheDocument();
  expect(screen.getByText('Mystery Drink')).toBeInTheDocument();
});

test('country filter options rescope to the selected category', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  expect(screen.getByRole('checkbox', { name: /france/i })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: /uk/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: /scotland/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: /japan/i })).not.toBeInTheDocument();
});
