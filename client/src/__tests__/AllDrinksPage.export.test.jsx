import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AllDrinksPage from '../pages/AllDrinksPage';
import * as csvExport from '../utils/csvExport';

const WINE = { id: 'w1', producer: 'Alpha', seriesAndName: 'Low', country: 'France', abv: '12', lastTasted: '01/01/2020', lastRating: '6', avgRating: 6, tastingCount: 1, notionLink: '' };
const BEER = { id: 'b1', brewery: 'Beta', name: 'High', country: 'UK', abv: '5', lastTasted: '31/12/2025', lastRating: '9', avgRating: 9, tastingCount: 1, notionLink: '' };

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const data = url.includes('wine') ? [WINE] : url.includes('beer') ? [BEER] : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
});

test('Export CSV downloads all drinks in the current sort order', async () => {
  const downloadSpy = vi.spyOn(csvExport, 'downloadCsv').mockImplementation(() => {});
  render(<MemoryRouter><AllDrinksPage /></MemoryRouter>);
  await screen.findByText('Low');
  fireEvent.click(screen.getByRole('button', { name: 'Top rated' }));

  fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

  expect(downloadSpy).toHaveBeenCalledTimes(1);
  const [filename, csv] = downloadSpy.mock.calls[0];
  expect(filename).toBe('all-drinks.csv');
  const lines = csv.split('\r\n');
  const betaLine = lines.findIndex(l => l.includes('Beta'));
  const alphaLine = lines.findIndex(l => l.includes('Alpha'));
  expect(betaLine).toBeGreaterThan(-1);
  expect(betaLine).toBeLessThan(alphaLine);

  downloadSpy.mockRestore();
});
