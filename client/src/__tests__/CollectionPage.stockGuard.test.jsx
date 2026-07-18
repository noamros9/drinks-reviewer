import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionPage from '../pages/CollectionPage';

const LOT = { id: 'lot1', quantity: 2, price: 45, addedAt: '2026-01-01' };
const DRINK = {
  id: 'w1', _category: 'wine', producer: 'Château X', seriesAndName: 'Grand Cru',
  country: 'France', abv: '13', avgRating: '9', collection: [LOT],
};

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('a second click while a stock update is in flight does not send a second request', async () => {
  const patch = deferred();
  global.fetch = vi.fn((url, opts) => {
    if (!opts) return Promise.resolve({ ok: true, json: () => Promise.resolve([DRINK]) });
    return patch.promise;
  });

  render(<MemoryRouter><CollectionPage /></MemoryRouter>);
  await screen.findByText('Grand Cru');

  const incrementBtn = screen.getByRole('button', { name: 'Add one bottle' });
  fireEvent.click(incrementBtn);
  fireEvent.click(incrementBtn);

  const patchCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'PATCH');
  expect(patchCalls).toHaveLength(1);
  expect(JSON.parse(patchCalls[0][1].body)).toEqual({ quantity: 3 });
  expect(incrementBtn).toBeDisabled();

  patch.resolve({ ok: true, json: () => Promise.resolve(LOT) });
  await screen.findByText('Grand Cru');
  expect(incrementBtn).not.toBeDisabled();
});
