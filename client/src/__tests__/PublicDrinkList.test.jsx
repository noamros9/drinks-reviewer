import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicDrinkList from '../components/PublicDrinkList';

function renderList(entries) {
  return render(<MemoryRouter><PublicDrinkList entries={entries} /></MemoryRouter>);
}

test('shows empty-state copy when there are no entries', () => {
  renderList([]);
  expect(screen.getByText('No shared drinks yet.')).toBeInTheDocument();
});

test('links each entry to its share page and shows category/rating', () => {
  const { container } = renderList([
    { id: '1', category: 'wine', producer: 'Chateau X', name: 'Reserve', avgRating: 8, photo: null },
    { id: '2', category: 'beer', producer: 'Brew Co', name: 'IPA', avgRating: null, photo: 'https://example.com/x.png' },
  ]);
  expect(screen.getByRole('link', { name: /Chateau X — Reserve/ })).toHaveAttribute('href', '/share/wine/1');
  expect(screen.getByRole('link', { name: /Brew Co — IPA/ })).toHaveAttribute('href', '/share/beer/2');
  expect(screen.getByText(/wine.*8\/10/)).toBeInTheDocument();
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/x.png');
});
