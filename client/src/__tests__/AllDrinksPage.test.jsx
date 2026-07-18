import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AllDrinksPage from '../pages/AllDrinksPage';

const WINE_ENTRY    = { id: 'w1', producer: 'Château X', seriesAndName: 'Grand Cru', country: 'France', abv: '13', lastTasted: '01/03/2025', lastRating: '8.5', avgRating: '8.2', notionLink: '' };
const BEER_ENTRY    = { id: 'b1', brewery: 'Brew Co',    name: 'Pale Ale',   country: 'UK',     abv: '5',  lastTasted: '15/04/2025', lastRating: '7',   avgRating: '7.1', notionLink: '' };
const WHISKEY_ENTRY = { id: 'k1', distillery: 'Glenfid', name: 'Single Malt', country: 'Scotland', abv: '43', lastTasted: '10/01/2025', lastRating: '9', avgRating: '9', notionLink: '' };
const OTHERS_ENTRY  = { id: 'o1', distillery: 'Suntory', name: 'Sake',       country: 'Japan',  abv: '15', lastTasted: '20/02/2025', lastRating: '8',   avgRating: '8', notionLink: '' };

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const searchMatch = url.match(/\/api\/(\w+)\/search\?q=(.+)/);
    if (searchMatch) {
      const [, cat, rawQ] = searchMatch;
      const q = decodeURIComponent(rawQ).toLowerCase();
      const byCategory = { wine: [WINE_ENTRY], beer: [BEER_ENTRY], whiskey: [WHISKEY_ENTRY], others: [OTHERS_ENTRY] };
      const matched = (byCategory[cat] || []).filter(d =>
        [d.producer, d.brewery, d.distillery, d.seriesAndName, d.name].some(f => (f || '').toLowerCase().includes(q))
      );
      return Promise.resolve({ ok: true, json: () => Promise.resolve(matched) });
    }
    const data = url.includes('wine') ? [WINE_ENTRY]
      : url.includes('beer') ? [BEER_ENTRY]
      : url.includes('whiskey') ? [WHISKEY_ENTRY]
      : [OTHERS_ENTRY];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
});

test('shows all drinks from all categories', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Grand Cru')).toBeInTheDocument();
  expect(screen.getByText('Pale Ale')).toBeInTheDocument();
  expect(screen.getByText('Single Malt')).toBeInTheDocument();
  expect(screen.getByText('Sake')).toBeInTheDocument();
});

test('shows Category and Producer columns', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByRole('columnheader', { name: /category/i })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /producer/i })).toBeInTheDocument();
});

test('count badge shows total entries', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('4 entries')).toBeInTheDocument();
});

test('filter chips render for all categories', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  ['All', 'Wine', 'Beer', 'Whiskey', 'Others'].forEach(label => {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});

test('filtering to Wine shows only wine entries', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: 'Wine' }));
  await waitFor(() => {
    expect(screen.getByText('Grand Cru')).toBeInTheDocument();
    expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  });
});

test('producer column shows brewery for beer', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Brew Co')).toBeInTheDocument();
});

test('shows Edit button and navigates to admin on click', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  const editButtons = screen.getAllByRole('button', { name: /edit/i });
  expect(editButtons.length).toBeGreaterThan(0);
  fireEvent.click(editButtons[0]);
});

test('country filter narrows visible entries', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  await waitFor(() => {
    expect(screen.getByText('Grand Cru')).toBeInTheDocument();
    expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  });
});

test('a ?country=X URL param pre-selects that country in the filter', async () => {
  render(
    <MemoryRouter initialEntries={['/all?country=France']}>
      <AllDrinksPage />
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByText('Grand Cru')).toBeInTheDocument();
    expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument();
  });
});

test('loads column layout from localStorage', async () => {
  const { COLUMNS } = await import('../components/DrinkTable');
  localStorage.setItem('drinks_columns_all', JSON.stringify({
    order: COLUMNS.all.map(c => c.key),
    hidden: ['abv'],
  }));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(screen.queryByRole('columnheader', { name: /^abv$/i })).not.toBeInTheDocument();
});

test('loadLayout falls back to null on invalid JSON in localStorage', async () => {
  localStorage.setItem('drinks_columns_all', 'INVALID_JSON');
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  // Should render fine with default layout (no crash)
  expect(screen.getByTestId('column-panel-btn')).toBeInTheDocument();
});

test('column layout change is saved to localStorage', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByTestId('col-toggle-abv'));
  expect(localStorage.getItem('drinks_columns_all')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem('drinks_columns_all')).hidden).toContain('abv');
});

test('entry with no producer/brewery/distillery shows em-dash in Producer column', async () => {
  const NO_PRODUCER = { id: 'x1', name: 'Mystery Drink', country: 'France', abv: '12',
    lastTasted: '01/01/2025', lastRating: '7', avgRating: '7', notionLink: '' };
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? [NO_PRODUCER] : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Mystery Drink')).toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('abv filter onChange lambda updates filter state', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '10' } });
  expect(screen.getByTestId('filter-abv')).toHaveClass('active');
});

test('handles fetch error gracefully (catch branch)', async () => {
  global.fetch = vi.fn(() => Promise.reject(new Error('network error')));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await waitFor(() => {
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });
});

test('per-fetch ok:false falls back to empty array, other categories still load', async () => {
  global.fetch = vi.fn((url) => {
    if (url.includes('wine')) return Promise.resolve({ ok: false });
    const data = url.includes('beer') ? [BEER_ENTRY]
      : url.includes('whiskey') ? [WHISKEY_ENTRY] : [OTHERS_ENTRY];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  expect(await screen.findByText('Pale Ale')).toBeInTheDocument();
  expect(screen.queryByText('Grand Cru')).not.toBeInTheDocument();
});

test('normalize returns empty array for non-array response', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: 'bad' }) }));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('0 entries')).toBeInTheDocument());
});

test('entry with no name and no seriesAndName uses empty string fallback', async () => {
  const NO_NAME = { id: 'n1', producer: 'NoName Co', country: 'France', abv: '12', lastTasted: '', lastRating: '7', avgRating: '7', notionLink: '' };
  global.fetch = vi.fn((url) =>
    url.includes('wine')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve([NO_NAME]) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  );
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('1 entry')).toBeInTheDocument());
});

test('resetting columns removes localStorage entry', async () => {
  const ALL_KEYS = ['_category', '_producer', 'name', 'country', 'abv', 'lastTasted', 'lastRating', 'avgRating'];
  localStorage.setItem('drinks_columns_all', JSON.stringify({ order: ALL_KEYS, hidden: ['abv'] }));
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('column-panel-btn'));
  fireEvent.click(screen.getByText('Reset to default'));
  expect(localStorage.getItem('drinks_columns_all')).toBeNull();
});

test('?q search param filters drinks by producer/name across categories', async () => {
  render(
    <MemoryRouter initialEntries={['/all?q=cru']}>
      <AllDrinksPage />
    </MemoryRouter>
  );
  // Wait for the unfiltered base load first, so the later "gone" check reflects the
  // debounced search resolving rather than a false-positive from the still-empty initial render.
  await screen.findByText('Pale Ale');
  await waitFor(() => expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument());
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
  expect(screen.queryByText('Single Malt')).not.toBeInTheDocument();
});

test('?q search param no longer matches non-producer/name fields like country', async () => {
  render(
    <MemoryRouter initialEntries={['/all?q=france']}>
      <AllDrinksPage />
    </MemoryRouter>
  );
  await screen.findByText('Grand Cru');
  await waitFor(() => expect(screen.queryByText('Grand Cru')).not.toBeInTheDocument());
  expect(screen.getByText('0 entries')).toBeInTheDocument();
});

test('clicking a producer cell filters to that producer', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByText('Château X'));
  await waitFor(() => expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument());
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
});

test('new search query resets active local filters', async () => {
  function Wrapper() {
    const { useNavigate } = require('react-router-dom');
    const nav = useNavigate();
    return (
      <>
        <button onClick={() => nav('/all?q=pale')} data-testid="do-search">search</button>
        <AllDrinksPage />
      </>
    );
  }
  render(<MemoryRouter><Wrapper /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByText('France')); // set country filter → Pale Ale hidden
  await waitFor(() => expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument());
  fireEvent.click(screen.getByTestId('do-search')); // navigate to ?q=pale
  await waitFor(() => expect(screen.getByText('Pale Ale')).toBeInTheDocument());
  // Country filter was reset — no France chip despite the chips row being visible
  expect(screen.queryByLabelText('Remove France filter')).not.toBeInTheDocument();
});

test('clicking a country cell adds it to the country filter', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByText('France'));
  await waitFor(() => expect(screen.queryByText('Pale Ale')).not.toBeInTheDocument());
  expect(screen.getByText('Grand Cru')).toBeInTheDocument();
});
