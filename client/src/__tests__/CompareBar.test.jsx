import { render, screen, fireEvent } from '@testing-library/react';
import CompareBar from '../components/CompareBar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => mockNavigate.mockClear());

test('shows the selected count', () => {
  render(<CompareBar category="wine" selectedIds={new Set(['1', '2'])} onCancel={() => {}} />);
  expect(screen.getByText('2 entries selected')).toBeInTheDocument();
});

test('Compare navigates to the compare route with both ids', () => {
  render(<CompareBar category="wine" selectedIds={new Set(['1', '2'])} onCancel={() => {}} />);
  fireEvent.click(screen.getByText('Compare'));
  expect(mockNavigate).toHaveBeenCalledWith('/compare?category=wine&a=1&b=2');
});

test('Cancel calls onCancel', () => {
  const onCancel = vi.fn();
  render(<CompareBar category="wine" selectedIds={new Set(['1', '2'])} onCancel={onCancel} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onCancel).toHaveBeenCalled();
});
