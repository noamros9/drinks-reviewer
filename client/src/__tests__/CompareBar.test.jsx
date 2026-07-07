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
  expect(screen.getByText('Compare 2')).toBeInTheDocument();
});

test('Compare navigates to the compare route with all selected ids, comma-separated', () => {
  render(<CompareBar category="wine" selectedIds={new Set(['1', '2', '3'])} onCancel={() => {}} />);
  fireEvent.click(screen.getByText('Compare 3'));
  expect(mockNavigate).toHaveBeenCalledWith('/compare?category=wine&ids=1,2,3');
});

test('supports up to 5 selected drinks', () => {
  render(<CompareBar category="wine" selectedIds={new Set(['1', '2', '3', '4', '5'])} onCancel={() => {}} />);
  fireEvent.click(screen.getByText('Compare 5'));
  expect(mockNavigate).toHaveBeenCalledWith('/compare?category=wine&ids=1,2,3,4,5');
});

test('Cancel calls onCancel', () => {
  const onCancel = vi.fn();
  render(<CompareBar category="wine" selectedIds={new Set(['1', '2'])} onCancel={onCancel} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onCancel).toHaveBeenCalled();
});
