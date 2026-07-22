import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';
import * as csvExport from '../utils/csvExport';

const DRINKS = [
  { id: '1', producer: 'Alpha', seriesAndName: 'Low', wineCategory: 'Red', variety: ['Merlot'], country: 'France', region: '', abv: '12', lastTasted: '01/01/2020', lastRating: '6', avgRating: 6, tastingCount: 1, notionLink: '' },
  { id: '2', producer: 'Beta',  seriesAndName: 'High', wineCategory: 'White', variety: ['Chardonnay'], country: 'Italy', region: '', abv: '13', lastTasted: '31/12/2025', lastRating: '9', avgRating: 9, tastingCount: 1, notionLink: '' },
];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(DRINKS) }));
});

test('Export CSV downloads the currently filtered/sorted rows', async () => {
  const downloadSpy = vi.spyOn(csvExport, 'downloadCsv').mockImplementation(() => {});
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Low');
  fireEvent.click(screen.getByRole('button', { name: 'Top rated' }));

  fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

  expect(downloadSpy).toHaveBeenCalledTimes(1);
  const [filename, csv] = downloadSpy.mock.calls[0];
  expect(filename).toBe('wine.csv');
  const betaLine = csv.split('\r\n').findIndex(l => l.includes('Beta'));
  const alphaLine = csv.split('\r\n').findIndex(l => l.includes('Alpha'));
  expect(betaLine).toBeGreaterThan(-1);
  expect(betaLine).toBeLessThan(alphaLine);

  downloadSpy.mockRestore();
});
