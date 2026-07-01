import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionPage from '../pages/CollectionPage';

const LOT = { id: 'lot1', quantity: 2, price: 45, addedAt: '2026-01-01' };
const WINE = { id: 'w1', _category: 'wine', producer: 'Château X', seriesAndName: 'Grand Cru', country: 'France', abv: '13', avgRating: '9', collection: [LOT] };
const BEER = { id: 'b1', _category: 'beer', brewery: 'Brew Co', name: 'Pale Ale', country: 'UK', abv: '5', collection: [LOT] };

function mockFetch(data = [WINE, BEER]) {
  global.fetch = vi.fn((url, opts) => {
    if (!opts) return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(LOT) });
  });
}

beforeEach(() => mockFetch());

afterEach(() => { localStorage.clear(); });

test('renders country filter dropdown', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByTestId('filter-dropdown-country')).toBeInTheDocument();
});

test('renders column panel button', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument();
});

test('country filter hides non-matching entries', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  fireEvent.click(document.body);
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
  expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
});

test('country chip appears when country filter active', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  fireEvent.click(document.body);
  expect(document.querySelector('.filter-chips')).toBeInTheDocument();
  expect(document.querySelector('.filter-chip').textContent).toContain('France');
});

test('clicking × on country chip removes the filter', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  fireEvent.click(document.body);
  fireEvent.click(screen.getByLabelText('Remove France filter'));
  await waitFor(() => expect(screen.getByText('Pale Ale')).toBeInTheDocument());
  expect(document.querySelector('.filter-chips')).not.toBeInTheDocument();
});

test('clicking a country cell adds it to the filter', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getAllByText('France')[0]);
  expect(document.querySelector('.filter-chip').textContent).toContain('France');
  expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
});

test('clicking a producer cell adds producer filter', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getAllByText('Château X')[0]);
  expect(document.querySelector('.filter-chip').textContent).toContain('Château X');
  expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
});

test('producer chip can be removed', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getAllByText('Château X')[0]);
  fireEvent.click(screen.getByLabelText('Remove producer filter'));
  await waitFor(() => expect(screen.getByText('Pale Ale')).toBeInTheDocument());
  expect(document.querySelector('.filter-chips')).not.toBeInTheDocument();
});

test('ABV filter hides entries outside range', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
  expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
});

test('ABV chip can be removed', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });
  fireEvent.click(screen.getByLabelText('Remove ABV filter'));
  await waitFor(() => expect(screen.getByText('Pale Ale')).toBeInTheDocument());
});

test('ABV chip shows max value when only max is set', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByPlaceholderText('∞'), { target: { value: '10' } });
  expect(screen.getByText(/ABV:.*10/)).toBeInTheDocument();
});

test('no chips when no filters active', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(document.querySelector('.filter-chips')).not.toBeInTheDocument();
});

test('count badge reflects filtered count', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  fireEvent.click(document.body);
  expect(screen.getByText('1 drink')).toBeInTheDocument();
});

test('column layout persists to localStorage', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(localStorage.getItem('drinks_columns_collection')).toBeNull();
});

test('loads column layout from localStorage on mount', async () => {
  const layout = { order: ['_category', '_producer', 'name', 'country', 'abv', 'notionLink'], hidden: [] };
  localStorage.setItem('drinks_columns_collection', JSON.stringify(layout));
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(localStorage.getItem('drinks_columns_collection')).toBeTruthy();
});

test('toggling a column calls handleColumnLayoutChange', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-abv'));
  expect(localStorage.getItem('drinks_columns_collection')).toBeTruthy();
});

test('resetting columns clears localStorage', async () => {
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-abv'));
  fireEvent.click(screen.getByRole('button', { name: /reset to default/i }));
  expect(localStorage.getItem('drinks_columns_collection')).toBeNull();
});

test('corrupt localStorage is handled gracefully', async () => {
  localStorage.setItem('drinks_columns_collection', 'not-json');
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
});
