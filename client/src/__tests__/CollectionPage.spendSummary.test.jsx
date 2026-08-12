import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionPage from '../pages/CollectionPage';

function mockFetch(collectionData) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(collectionData) }));
}

test('spend summary is hidden with nothing in stock', async () => {
  mockFetch([{ id: 'w1', _category: 'wine', producer: 'Empty', collection: [] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('0 drinks');
  expect(screen.queryByTestId('spend-summary')).not.toBeInTheDocument();
});

test('spend summary shows Value, Bottles and Priciest once stock exists, and tracks the category tab', async () => {
  mockFetch([
    { id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve', collection: [{ id: 'l1', quantity: 2, price: 50 }] },
    { id: 'b1', _category: 'beer', brewery: 'Brewery', name: 'Ale', collection: [{ id: 'l2', quantity: 1, price: 20 }] },
  ]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('2 drinks');
  const summary = within(screen.getByTestId('spend-summary'));
  expect(summary.getByText('Value')).toBeInTheDocument();
  expect(summary.getByText('120 ₪')).toBeInTheDocument();
  expect(summary.getByText('3')).toBeInTheDocument();
  expect(summary.getByText(/Chateau Reserve/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  await screen.findByText('1 drink');
  expect(within(screen.getByTestId('spend-summary')).getByText('100 ₪')).toBeInTheDocument();
});

test('Avg Bottle only appears once a category tab is selected', async () => {
  mockFetch([{ id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve', collection: [{ id: 'l1', quantity: 2, price: 50 }] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('1 drink');
  expect(screen.queryByText('Avg Bottle')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  await screen.findByText('Avg Bottle');
  expect(within(screen.getByTestId('spend-summary')).getByText('50 ₪')).toBeInTheDocument();
});

test('shows an unpriced-bottles note when in-stock bottles have no price', async () => {
  mockFetch([{ id: 'w1', _category: 'wine', producer: 'Chateau', seriesAndName: 'Reserve', collection: [{ id: 'l1', quantity: 1, price: null }] }]);
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('1 drink');
  expect(screen.getByText('1 bottle unpriced.')).toBeInTheDocument();
});
