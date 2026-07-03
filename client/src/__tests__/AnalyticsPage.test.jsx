import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsPage from '../pages/AnalyticsPage';

const WINE_ENTRIES    = [{ id: 'w1', avgRating: 7.5 }, { id: 'w2', avgRating: 4 }];
const BEER_ENTRIES    = [{ id: 'b1', avgRating: 9 }];
const WHISKEY_ENTRIES = [{ id: 'k1', avgRating: 9.2 }];
const OTHERS_ENTRIES  = [{ id: 'o1', avgRating: 4 }];

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? WINE_ENTRIES
      : url.includes('beer') ? BEER_ENTRIES
      : url.includes('whiskey') ? WHISKEY_ENTRIES
      : OTHERS_ENTRIES;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
});

test('fetches all four categories once and renders Rating as the sole/active tab', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  expect(await screen.findByText('5 rated drinks')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(screen.getByRole('button', { name: 'Rating' })).toHaveClass('active');
});

test('global category filter defaults to All and re-buckets the active section', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  const globalFilter = within(screen.getByTestId('global-category-filter'));
  expect(globalFilter.getByRole('button', { name: 'All' })).toHaveClass('active');

  fireEvent.click(globalFilter.getByRole('button', { name: 'Wine' }));
  await waitFor(() => expect(screen.getByText('2 rated drinks')).toBeInTheDocument());
});

test('empty fetch results pass through to the active section', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  expect(await screen.findByText('No rated drinks yet.')).toBeInTheDocument();
});

test('clicking the Geographic tab renders GeographicSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Geographic' }));
  expect(await screen.findByText(/drinks with country data/)).toBeInTheDocument();
});
