import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';

const WINE_DRINKS = [
  { id: '1', producer: 'Citra', seriesAndName: 'Bisanzio', wineCategory: 'White', country: 'Italy', region: 'Abruzzo' },
  { id: '2', producer: 'Latroun', seriesAndName: 'Reserve', wineCategory: 'Red', country: 'Israel', region: 'Judean Hills' },
];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_DRINKS) }));
  window.confirm = vi.fn(() => true);
});

test('no bulk edit bar when nothing is selected', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  expect(screen.queryByTestId('bulk-edit-bar')).not.toBeInTheDocument();
});

test('selecting a row shows the bulk edit bar with the right count', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  const bar = screen.getByTestId('bulk-edit-bar');
  expect(bar).toBeInTheDocument();
  expect(within(bar).getByText('1 entry selected')).toBeInTheDocument();
});

test('selecting all via the header checkbox selects every visible row', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select all rows'));
  expect(within(screen.getByTestId('bulk-edit-bar')).getByText('2 entries selected')).toBeInTheDocument();
});

test('clicking an already-selected row checkbox deselects it', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  expect(within(screen.getByTestId('bulk-edit-bar')).getByText('1 entry selected')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Select row 1'));
  expect(screen.queryByTestId('bulk-edit-bar')).not.toBeInTheDocument();
});

test('clicking select-all again when everything is selected deselects everything', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select all rows'));
  fireEvent.click(screen.getByLabelText('Select all rows'));
  expect(screen.queryByTestId('bulk-edit-bar')).not.toBeInTheDocument();
});

test('Cancel in the bulk edit bar hides it and clears selection', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  fireEvent.click(within(screen.getByTestId('bulk-edit-bar')).getByText('Cancel'));
  expect(screen.queryByTestId('bulk-edit-bar')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Select row 1')).not.toBeChecked();
});

test('a successful bulk apply updates the table and hides the bar', async () => {
  render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));

  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ updated: [{ ...WINE_DRINKS[0], region: 'Bordeaux' }] }),
  });
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'Bordeaux' } });
  fireEvent.click(screen.getByRole('button', { name: /apply to 1/i }));

  await waitFor(() => expect(screen.queryByTestId('bulk-edit-bar')).not.toBeInTheDocument());
  expect(screen.getAllByText('Bordeaux').length).toBeGreaterThan(0);
});

test('switching category clears the selection', async () => {
  const { rerender } = render(<MemoryRouter><CategoryPage category="wine" /></MemoryRouter>);
  await screen.findByText('Bisanzio');
  fireEvent.click(screen.getByLabelText('Select row 1'));
  expect(screen.getByTestId('bulk-edit-bar')).toBeInTheDocument();

  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  rerender(<MemoryRouter><CategoryPage category="beer" /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByTestId('bulk-edit-bar')).not.toBeInTheDocument());
});
