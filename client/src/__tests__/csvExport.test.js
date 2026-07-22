import { rowsToCsv, downloadCsv } from '../utils/csvExport';

const COLUMNS = [
  { key: 'producer', label: 'Producer' },
  { key: 'name', label: 'Name' },
  { key: 'tags', label: 'Tags' },
];

test('builds a header row plus one row per entry', () => {
  const csv = rowsToCsv([{ producer: 'Alpha', name: 'One', tags: [] }], COLUMNS);
  expect(csv).toBe('Producer,Name,Tags\r\nAlpha,One,');
});

test('quotes and escapes values containing commas, quotes, or newlines', () => {
  const csv = rowsToCsv([{ producer: 'A, B "Reserve"', name: 'Line1\nLine2', tags: [] }], COLUMNS);
  expect(csv).toBe('Producer,Name,Tags\r\n"A, B ""Reserve""","Line1\nLine2",');
});

test('joins array values with a semicolon', () => {
  const csv = rowsToCsv([{ producer: 'Alpha', name: 'One', tags: ['Red', 'Dry'] }], COLUMNS);
  expect(csv).toContain('Red; Dry');
});

test('renders null/undefined cells as empty', () => {
  const csv = rowsToCsv([{ producer: 'Alpha', name: undefined, tags: null }], COLUMNS);
  expect(csv).toBe('Producer,Name,Tags\r\nAlpha,,');
});

test('downloadCsv creates an object URL, triggers a click, and revokes the URL', () => {
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  downloadCsv('wine.csv', 'a,b\r\n1,2');

  expect(createUrl).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeUrl).toHaveBeenCalledWith('blob:mock');

  createUrl.mockRestore();
  revokeUrl.mockRestore();
  clickSpy.mockRestore();
});
