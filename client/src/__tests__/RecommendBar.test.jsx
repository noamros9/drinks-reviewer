import { render, screen, fireEvent } from '@testing-library/react';
import RecommendBar from '../components/RecommendBar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => mockNavigate.mockClear());

test('shows the selected count', () => {
  render(<RecommendBar category="wine" selectedIds={new Set(['1', '2'])} onCancel={() => {}} />);
  expect(screen.getByText('2 entries selected')).toBeInTheDocument();
});

test('Recommend similar navigates to the recommend route with id:category pairs', () => {
  render(<RecommendBar category="wine" selectedIds={new Set(['1', '2', '3'])} onCancel={() => {}} />);
  fireEvent.click(screen.getByText('Recommend similar'));
  expect(mockNavigate).toHaveBeenCalledWith('/recommend?seeds=1:wine,2:wine,3:wine');
});

test('Cancel calls onCancel', () => {
  const onCancel = vi.fn();
  render(<RecommendBar category="wine" selectedIds={new Set(['1', '2'])} onCancel={onCancel} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onCancel).toHaveBeenCalled();
});
