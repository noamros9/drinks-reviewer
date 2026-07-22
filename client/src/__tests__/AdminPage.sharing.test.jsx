import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

const EDIT_DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: ['Merlot'], country: 'France', region: '', abv: '13',
  notionLink: '', tags: [], tastings: [], shared: false,
};

function mockFetch(settings = { catalogPublic: false }) {
  global.fetch = vi.fn((url) => {
    if (url === '/api/settings') return Promise.resolve({ ok: true, json: () => Promise.resolve(settings) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function renderAdmin(state = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state }]}>
      <AdminPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockFetch();
});

test('catalog toggle is unchecked and no link when catalog is private', async () => {
  renderAdmin();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/settings'));
  expect(screen.getByLabelText('Public catalog')).not.toBeChecked();
  expect(screen.queryByRole('link', { name: /view public catalog/i })).not.toBeInTheDocument();
});

test('catalog toggle reflects a public catalog and shows a link to it', async () => {
  mockFetch({ catalogPublic: true });
  renderAdmin();
  await waitFor(() => expect(screen.getByLabelText('Public catalog')).toBeChecked());
  expect(screen.getByRole('link', { name: /view public catalog/i })).toHaveAttribute('href', '/catalog');
});

test('checking the catalog toggle PATCHes settings', async () => {
  renderAdmin();
  await waitFor(() => expect(screen.getByLabelText('Public catalog')).not.toBeChecked());
  fireEvent.click(screen.getByLabelText('Public catalog'));
  expect(screen.getByLabelText('Public catalog')).toBeChecked();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ catalogPublic: true }),
  })));
});

test('share toggle is absent when adding a new entry', () => {
  renderAdmin();
  expect(screen.queryByLabelText('Share this drink')).not.toBeInTheDocument();
});

test('share toggle is present but unchecked with no link when editing an unshared drink', () => {
  renderAdmin({ category: 'wine', drink: EDIT_DRINK });
  expect(screen.getByLabelText('Share this drink')).not.toBeChecked();
  expect(screen.queryByTestId('share-link')).not.toBeInTheDocument();
});

test('checking the share toggle PATCHes the drink and reveals the copyable link', async () => {
  renderAdmin({ category: 'wine', drink: EDIT_DRINK });
  fireEvent.click(screen.getByLabelText('Share this drink'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine/1/share', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ shared: true }),
  })));
  expect(await screen.findByTestId('share-link')).toHaveValue(`${window.location.origin}/share/wine/1`);
});

test('unchecking the share toggle hides the copyable link', async () => {
  renderAdmin({ category: 'wine', drink: { ...EDIT_DRINK, shared: true } });
  expect(screen.getByTestId('share-link')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Share this drink'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine/1/share', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ shared: false }),
  })));
  expect(screen.queryByTestId('share-link')).not.toBeInTheDocument();
});

test('shows an error message when the share toggle fails', async () => {
  renderAdmin({ category: 'wine', drink: EDIT_DRINK });
  global.fetch.mockResolvedValueOnce({ ok: false });
  fireEvent.click(screen.getByLabelText('Share this drink'));
  await waitFor(() => expect(screen.getByText(/failed to update sharing/i)).toBeInTheDocument());
  expect(screen.getByLabelText('Share this drink')).not.toBeChecked();
});
