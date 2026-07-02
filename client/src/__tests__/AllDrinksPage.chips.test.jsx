import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AllDrinksPage from '../pages/AllDrinksPage';

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

const WINE = { id: 'w1', producer: 'Château X', seriesAndName: 'Grand Cru', country: 'France', abv: '13', lastTasted: '01/03/2025', lastRating: '8.5', avgRating: '8.2', notionLink: '' };
const BEER = { id: 'b1', brewery: 'Brew Co', name: 'Pale Ale', country: 'UK', abv: '5', lastTasted: '15/04/2025', lastRating: '7', avgRating: '7.1', notionLink: '' };

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? [WINE] : url.includes('beer') ? [BEER] : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
});

test('no chips when no filters active', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  expect(document.querySelector('.filter-chips')).not.toBeInTheDocument();
});

test('country chip appears when country filter active', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  fireEvent.click(document.body); // close dropdown
  expect(document.querySelector('.filter-chips')).toBeInTheDocument();
  expect(document.querySelector('.filter-chip').textContent).toContain('France');
});

test('clicking × on country chip removes that country', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-dropdown-country'));
  fireEvent.click(screen.getByRole('checkbox', { name: /france/i }));
  fireEvent.click(document.body); // close dropdown
  fireEvent.click(screen.getByLabelText('Remove France filter'));
  await waitFor(() => expect(screen.getByText('Pale Ale')).toBeInTheDocument());
  expect(document.querySelector('.filter-chips')).not.toBeInTheDocument();
});

test('producer chip appears when producer filter active', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByText('Château X'));
  expect(screen.getByText(/producer: château x/i)).toBeInTheDocument();
});

test('clicking × on producer chip clears producer filter', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByText('Château X'));
  fireEvent.click(screen.getByLabelText('Remove producer filter'));
  await waitFor(() => expect(screen.getByText('Pale Ale')).toBeInTheDocument());
});

test('ABV chip appears when ABV filter active', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '10' } });
  expect(screen.getByText('ABV: 10–∞')).toBeInTheDocument();
});

test('clicking × on ABV chip clears ABV filter', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '10' } });
  fireEvent.click(screen.getByLabelText('Remove ABV filter'));
  await waitFor(() => expect(document.querySelector('.filter-chips')).not.toBeInTheDocument());
});

test('ABV chip shows 0 fallback when only abvMax set', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-max'), { target: { value: '15' } });
  expect(screen.getByText('ABV: 0–15')).toBeInTheDocument();
});

test('Avg Rating chip appears when Avg Rating filter active, with bounded max fallback', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-avgRating'));
  fireEvent.change(screen.getByTestId('avgRating-min'), { target: { value: '7' } });
  expect(screen.getByText('Avg Rating: 7–10')).toBeInTheDocument();
});

test('clicking × on Avg Rating chip clears the filter', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-avgRating'));
  fireEvent.change(screen.getByTestId('avgRating-min'), { target: { value: '7' } });
  fireEvent.click(screen.getByLabelText('Remove Avg Rating filter'));
  await waitFor(() => expect(document.querySelector('.filter-chips')).not.toBeInTheDocument());
});

test('search chip appears when ?q param set', async () => {
  render(
    <MemoryRouter initialEntries={['/all?q=france']}>
      <AllDrinksPage />
    </MemoryRouter>
  );
  await screen.findByText('Grand Cru');
  expect(screen.getByText('Search: france')).toBeInTheDocument();
});

test('clicking × on search chip clears ?q from URL', async () => {
  render(
    <MemoryRouter initialEntries={['/all?q=france']}>
      <AllDrinksPage />
      <LocationDisplay />
    </MemoryRouter>
  );
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByLabelText('Clear search'));
  expect(screen.getByTestId('location').textContent).toBe('/all');
});

test('ABV chip appears when abvMin is string "0"', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '0' } });
  expect(screen.getByText('ABV: 0–∞')).toBeInTheDocument();
});

test('ABV chip × clears when abvMin is "0"', async () => {
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByTestId('filter-abv'));
  fireEvent.change(screen.getByTestId('abv-min'), { target: { value: '0' } });
  fireEvent.click(screen.getByLabelText('Remove ABV filter'));
  await waitFor(() => expect(document.querySelector('.filter-chips')).not.toBeInTheDocument());
});
