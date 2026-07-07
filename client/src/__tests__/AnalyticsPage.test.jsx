import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import AnalyticsPage from '../pages/AnalyticsPage';

function LocationProbe() {
  const [searchParams] = useSearchParams();
  return <div data-testid="location-probe">{searchParams.toString()}</div>;
}

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

test('clicking the Time & Pace tab renders TimePaceSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Time & Pace' }));
  expect(await screen.findByText(/tasted drinks?/)).toBeInTheDocument();
});

test('clicking the Style & Variety tab renders StyleSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Style & Variety' }));
  expect(await screen.findByText('Wine — varieties')).toBeInTheDocument();
});

test('clicking the Producer tab renders ProducerSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Producer' }));
  expect(await screen.findByText('Wine — producers')).toBeInTheDocument();
});

test('clicking the Vintage tab renders VintageSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Vintage' }));
  expect(await screen.findByText('Best Vintages')).toBeInTheDocument();
});

test('clicking the Exploration tab renders ExplorationSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Exploration' }));
  expect(await screen.findByText('Best Of (weighted rating)')).toBeInTheDocument();
});

test('clicking the Value tab renders ValueSection', async () => {
  render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'Value' }));
  expect(await screen.findByText('Price vs Rating')).toBeInTheDocument();
});

test('a ?tab= URL param lands directly on that section', async () => {
  render(
    <MemoryRouter initialEntries={['/analytics?tab=geographic']}>
      <AnalyticsPage />
    </MemoryRouter>
  );
  expect(await screen.findByText(/drinks with country data/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Geographic' })).toHaveClass('active');
});

test('an unrecognized ?tab= value falls back to the first section', async () => {
  render(
    <MemoryRouter initialEntries={['/analytics?tab=nonsense']}>
      <AnalyticsPage />
    </MemoryRouter>
  );
  expect(await screen.findByText('5 rated drinks')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rating' })).toHaveClass('active');
});

test('clicking a tab updates the URL\'s tab param', async () => {
  render(
    <MemoryRouter>
      <AnalyticsPage />
      <LocationProbe />
    </MemoryRouter>
  );
  await screen.findByText('5 rated drinks');
  fireEvent.click(screen.getByRole('button', { name: 'ABV' }));
  expect(screen.getByTestId('location-probe')).toHaveTextContent('tab=abv');
});
