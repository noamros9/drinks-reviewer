import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import RecommendPage from '../pages/RecommendPage';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function NavButton({ to }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go</button>;
}

function Harness({ initial }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <NavButton to="/recommend?seeds=3:wine" />
      <Routes>
        <Route path="/recommend" element={<RecommendPage />} />
      </Routes>
    </MemoryRouter>
  );
}

test('a slower, older seeds request does not overwrite the result of a newer one', async () => {
  const first = deferred();
  const second = deferred();
  global.fetch = vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

  render(<Harness initial="/recommend?seeds=1:wine" />);
  fireEvent.click(screen.getByText('go'));

  await act(async () => {
    second.resolve({ ok: true, json: () => Promise.resolve({ ownCatalogue: [{ id: '2', category: 'wine', label: 'Newer Match' }], availableInIsrael: [], notAvailable: [] }) });
    await flushMicrotasks();
  });
  expect(await screen.findByTestId('recommend-own-catalogue')).toHaveTextContent('Newer Match');

  await act(async () => {
    first.resolve({ ok: true, json: () => Promise.resolve({ ownCatalogue: [{ id: '1', category: 'wine', label: 'Older Match' }], availableInIsrael: [], notAvailable: [] }) });
    await flushMicrotasks();
  });
  expect(screen.getByTestId('recommend-own-catalogue')).toHaveTextContent('Newer Match');
  expect(screen.queryByText('Older Match')).not.toBeInTheDocument();
});
