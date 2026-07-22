import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionPage from '../pages/CollectionPage';
import * as csvExport from '../utils/csvExport';

const LOT = { id: 'lot1', quantity: 2, price: 45, addedAt: '2026-01-01' };
const DRINKS = [
  { id: 'w1', _category: 'wine', producer: 'Château X', seriesAndName: 'Grand Cru', country: 'France', abv: '13', avgRating: '9', collection: [LOT] },
  { id: 'b1', _category: 'beer', brewery: 'Brew Co', name: 'Hoppy IPA', country: 'UK', abv: '5', avgRating: '7', collection: [LOT] },
];

beforeEach(() => {
  global.fetch = vi.fn((url, opts) => {
    if (!opts) return Promise.resolve({ ok: true, json: () => Promise.resolve(DRINKS) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(LOT) });
  });
});

test('Export CSV downloads the currently filtered collection rows', async () => {
  const downloadSpy = vi.spyOn(csvExport, 'downloadCsv').mockImplementation(() => {});
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');

  fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

  expect(downloadSpy).toHaveBeenCalledTimes(1);
  const [filename, csv] = downloadSpy.mock.calls[0];
  expect(filename).toBe('collection.csv');
  expect(csv).toContain('Château X');
  expect(csv).toContain('Brew Co');

  downloadSpy.mockRestore();
});

test('Export CSV only includes drinks matching the active category tab', async () => {
  const downloadSpy = vi.spyOn(csvExport, 'downloadCsv').mockImplementation(() => {});
  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');
  fireEvent.click(screen.getByRole('button', { name: /^wine$/i }));

  fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

  const [, csv] = downloadSpy.mock.calls[0];
  expect(csv).toContain('Château X');
  expect(csv).not.toContain('Brew Co');

  downloadSpy.mockRestore();
});
