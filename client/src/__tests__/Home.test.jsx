import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([]) })
  );
});

test('renders 4 category cards linking to correct routes', () => {
  render(<MemoryRouter><Home /></MemoryRouter>);

  const wineLink = screen.getByRole('link', { name: /wine/i });
  const beerLink = screen.getByRole('link', { name: /beer/i });
  const whiskeyLink = screen.getByRole('link', { name: /whiskey/i });
  const othersLink = screen.getByRole('link', { name: /others/i });

  expect(wineLink).toHaveAttribute('href', '/wine');
  expect(beerLink).toHaveAttribute('href', '/beer');
  expect(whiskeyLink).toHaveAttribute('href', '/whiskey');
  expect(othersLink).toHaveAttribute('href', '/others');
});
