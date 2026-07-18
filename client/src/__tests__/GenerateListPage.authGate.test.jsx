import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GenerateListPage from '../pages/GenerateListPage';

test('fetches on mount so an unauthenticated visit triggers the global 401 redirect', () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 401 }));
  render(<MemoryRouter><GenerateListPage /></MemoryRouter>);
  expect(global.fetch).toHaveBeenCalledWith('/api/tags');
});
