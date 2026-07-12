import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GenerateListPage from '../pages/GenerateListPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const RESULT = {
  prompt: 'something bold',
  inCollection: [
    { id: '1', category: 'wine', label: 'Citra Bisanzio', reason: 'bold tannins' },
  ],
  elsewhereInCatalogue: [
    { id: '9', category: 'beer', label: 'Brew Co IPA', reason: 'hoppy' },
  ],
  toBuy: [
    { name: 'Some Buyable Wine', description: 'a real find', url: 'https://example.com/wine' },
  ],
};

const WINE_DRINKS = [{ id: '1', producer: 'Citra', seriesAndName: 'Bisanzio' }];
const BEER_DRINKS = [{ id: '9', brewery: 'Brew Co', name: 'IPA' }];

function renderPage() {
  return render(<MemoryRouter><GenerateListPage /></MemoryRouter>);
}

function typePrompt(text) {
  fireEvent.change(screen.getByLabelText(/Describe what you're looking for/i), { target: { value: text } });
}

beforeEach(() => {
  mockNavigate.mockClear();
  global.fetch = vi.fn((url) => {
    if (url === '/api/generate-list') return Promise.resolve({ ok: true, json: () => Promise.resolve(RESULT) });
    if (url === '/api/wine') return Promise.resolve({ ok: true, json: () => Promise.resolve(WINE_DRINKS) });
    if (url === '/api/beer') return Promise.resolve({ ok: true, json: () => Promise.resolve(BEER_DRINKS) });
    return Promise.resolve({ ok: false });
  });
});

test('submit button is disabled until a prompt is entered', () => {
  renderPage();
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  typePrompt('something bold');
  expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
});

test('does not call the API for a blank/whitespace prompt', () => {
  renderPage();
  typePrompt('   ');
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  expect(global.fetch).not.toHaveBeenCalled();
});

test('shows a loading message, then all three sections', async () => {
  renderPage();
  typePrompt('something bold');
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  expect(screen.getByText(/Generating your list/)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/generate-list', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ prompt: 'something bold' }),
  }));

  const collection = await screen.findByTestId('generate-list-collection');
  expect(collection).toHaveTextContent('Citra Bisanzio');
  expect(collection).toHaveTextContent('bold tannins');

  const elsewhere = screen.getByTestId('generate-list-elsewhere');
  expect(elsewhere).toHaveTextContent('Brew Co IPA');

  const toBuy = screen.getByTestId('generate-list-to-buy');
  expect(toBuy).toHaveTextContent('Some Buyable Wine');
  expect(screen.getByRole('link', { name: 'Some Buyable Wine' })).toHaveAttribute('href', 'https://example.com/wine');
});

test('clicking an in-collection result navigates to admin with the full drink', async () => {
  renderPage();
  typePrompt('something bold');
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  const button = await screen.findByText(/Citra Bisanzio/);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine'));
  fireEvent.click(button);
  expect(mockNavigate).toHaveBeenCalledWith('/admin', {
    state: { drink: WINE_DRINKS[0], category: 'wine', tab: 'tastings' },
  });
});

test('shows empty states for each section when nothing comes back', async () => {
  global.fetch = vi.fn((url) => {
    if (url === '/api/generate-list') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ prompt: 'x', inCollection: [], elsewhereInCatalogue: [], toBuy: [] }) });
    }
    return Promise.resolve({ ok: false });
  });
  renderPage();
  typePrompt('something obscure');
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  expect(await screen.findByText('Nothing in your collection matches that.')).toBeInTheDocument();
  expect(screen.getByText('Nothing else in your catalogue matches that.')).toBeInTheDocument();
  expect(screen.getByText('No purchasable matches found.')).toBeInTheDocument();
});

test('shows an error state when the API call fails', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Add some drinks to your catalogue first' }) }));
  renderPage();
  typePrompt('something bold');
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  expect(await screen.findByText('Add some drinks to your catalogue first')).toBeInTheDocument();
});
