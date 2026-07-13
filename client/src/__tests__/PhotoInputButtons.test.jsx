import { render, screen, fireEvent } from '@testing-library/react';
import PhotoInputButtons from '../components/PhotoInputButtons';

test('renders a camera-capture input and a library input, both calling onSelect', () => {
  const onSelect = vi.fn();
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-photo-add" testId="photo" onSelect={onSelect} />);

  const inputs = document.querySelectorAll('input[type="file"]');
  expect(inputs).toHaveLength(2);
  expect(inputs[0]).toHaveAttribute('capture', 'environment');
  expect(inputs[1]).not.toHaveAttribute('capture');

  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(inputs[0], { target: { files: [file] } });
  expect(onSelect).toHaveBeenCalledWith(file);

  fireEvent.change(inputs[1], { target: { files: [file] } });
  expect(onSelect).toHaveBeenCalledTimes(2);
});

test('shows "Change photo" on the library button once a photo exists', () => {
  render(<PhotoInputButtons hasPhoto label="Add photo" variant="btn-upload-img" onSelect={() => {}} />);
  expect(screen.getByText('Change photo')).toBeInTheDocument();
});

test('shows the fallback label on the library button when no photo exists', () => {
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-upload-img" onSelect={() => {}} />);
  expect(screen.getByText('Add photo')).toBeInTheDocument();
});
