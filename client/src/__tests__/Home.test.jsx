import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([]) })
  );
});

test('renders 5 category cards linking to correct routes', () => {
  render(<MemoryRouter><Home /></MemoryRouter>);

  const collectionLink = screen.getByRole('link', { name: /collection/i });
  const wineLink = screen.getByRole('link', { name: /wine/i });
  const beerLink = screen.getByRole('link', { name: /beer/i });
  const whiskeyLink = screen.getByRole('link', { name: /whiskey/i });
  const othersLink = screen.getByRole('link', { name: /other reviews/i });

  expect(collectionLink).toHaveAttribute('href', '/collection');
  expect(wineLink).toHaveAttribute('href', '/wine');
  expect(beerLink).toHaveAttribute('href', '/beer');
  expect(whiskeyLink).toHaveAttribute('href', '/whiskey');
  expect(othersLink).toHaveAttribute('href', '/others');
});
