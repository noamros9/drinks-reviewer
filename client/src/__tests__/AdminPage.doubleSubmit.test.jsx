import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';

vi.mock('react-datepicker', () => ({
  default: ({ onChange, selected, placeholderText }) => (
    <input
      data-testid="mock-datepicker"
      type="text"
      placeholder={placeholderText}
      value={selected ? 'set' : ''}
      readOnly
      onClick={() => onChange(new Date('2025-03-15'))}
    />
  ),
}));

const EDIT_DRINK = {
  id: '1', producer: 'X', seriesAndName: 'Y', wineCategory: 'Red',
  variety: ['Merlot'], country: 'France', region: '', abv: '13',
  notionLink: '', tags: [], tastings: [],
};

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('clicking Add Tasting twice before the first request resolves only sends one POST', async () => {
  const post = deferred();
  global.fetch = vi.fn((url, opts) => {
    if (opts?.method === 'POST') return post.promise;
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });

  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: { category: 'wine', drink: EDIT_DRINK } }]}>
      <AdminPage />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /^tastings$/i }));
  fireEvent.click(screen.getByTestId('mock-datepicker'));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } });

  const addBtn = screen.getByRole('button', { name: /add tasting/i });
  fireEvent.click(addBtn);
  fireEvent.click(addBtn);

  const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
  expect(postCalls).toHaveLength(1);
  expect(addBtn).toBeDisabled();

  post.resolve({ ok: true, json: () => Promise.resolve({ ...EDIT_DRINK, tastings: [{ id: 't1', date: '15/03/2025', rating: 9 }] }) });
  await screen.findByText('Tasting added!');
  expect(addBtn).not.toBeDisabled();
});
