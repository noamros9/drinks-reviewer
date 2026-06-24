import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryPage from '../pages/CategoryPage';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve([]) })
  );
});

test.each(['wine', 'beer', 'whiskey', 'others'])(
  'shows empty state for %s when there are no entries',
  async (category) => {
    render(
      <MemoryRouter>
        <CategoryPage category={category} />
      </MemoryRouter>
    );
    expect(await screen.findByText(/no entries yet/i)).toBeInTheDocument();
  }
);

test.each([
  ['wine', 'Producer'],
  ['beer', 'Brewery'],
  ['whiskey', 'Distillery'],
  ['others', 'Category'],
])('%s table has correct first column header', async (category, header) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve([
          { id: '1', producer: 'X', brewery: 'X', distillery: 'X', drinkCategory: 'Rum', name: 'Y' },
        ]),
    })
  );
  render(
    <MemoryRouter>
      <CategoryPage category={category} />
    </MemoryRouter>
  );
  expect(await screen.findByText(header)).toBeInTheDocument();
});
