import { render, screen, fireEvent } from '@testing-library/react';
import StatTileRow from '../components/StatTileRow';

test('renders each tile\'s label and value', () => {
  render(<StatTileRow tiles={[{ label: '≥ 7', value: '42.3%' }, { label: '≥ 8', value: '20%' }]} />);
  expect(screen.getByText('≥ 7')).toBeInTheDocument();
  expect(screen.getByText('42.3%')).toBeInTheDocument();
  expect(screen.getByText('≥ 8')).toBeInTheDocument();
  expect(screen.getByText('20%')).toBeInTheDocument();
});

test('a tile without onClick renders as non-interactive', () => {
  render(<StatTileRow tiles={[{ label: '≥ 7', value: '42.3%' }]} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('a tile with onClick renders as a button and fires on click', () => {
  const onClick = vi.fn();
  render(<StatTileRow tiles={[{ label: '≥ 7', value: '42.3%', onClick }]} />);
  fireEvent.click(screen.getByRole('button', { name: /≥ 7/ }));
  expect(onClick).toHaveBeenCalled();
});
