import { render, screen, fireEvent } from '@testing-library/react';
import PhotoInputButtons from '../components/PhotoInputButtons';

function openMenu() {
  fireEvent.click(screen.getByTestId('photo-trigger'));
}

test('trigger button is closed by default; clicking it reveals Take Photo / Choose from Gallery', () => {
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-photo-add" testId="photo" onSelect={() => {}} />);
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
  openMenu();
  const inputs = document.querySelectorAll('input[type="file"]');
  expect(inputs).toHaveLength(2);
  expect(inputs[0]).toHaveAttribute('capture', 'environment');
  expect(inputs[1]).not.toHaveAttribute('capture');
  expect(inputs[0]).toHaveAttribute('data-testid', 'photo-camera');
  expect(inputs[1]).toHaveAttribute('data-testid', 'photo');
});

test('picking a camera file calls onSelect and closes the menu', () => {
  const onSelect = vi.fn();
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-photo-add" testId="photo" onSelect={onSelect} />);
  openMenu();
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(document.querySelectorAll('input[type="file"]')[0], { target: { files: [file] } });
  expect(onSelect).toHaveBeenCalledWith(file);
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
});

test('picking a gallery file calls onSelect and closes the menu', () => {
  const onSelect = vi.fn();
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-photo-add" testId="photo" onSelect={onSelect} />);
  openMenu();
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(document.querySelectorAll('input[type="file"]')[1], { target: { files: [file] } });
  expect(onSelect).toHaveBeenCalledWith(file);
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
});

test('clicking outside closes the menu', () => {
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-photo-add" testId="photo" onSelect={() => {}} />);
  openMenu();
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(2);
  fireEvent.mouseDown(document.body);
  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
});

test('shows "Change photo" on the trigger once a photo exists', () => {
  render(<PhotoInputButtons hasPhoto label="Add photo" variant="btn-upload-img" onSelect={() => {}} />);
  expect(screen.getByText('Change photo')).toBeInTheDocument();
});

test('shows the fallback label on the trigger when no photo exists', () => {
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-upload-img" onSelect={() => {}} />);
  expect(screen.getByText('Add photo')).toBeInTheDocument();
});

test('openUp adds the upward-opening menu class', () => {
  render(<PhotoInputButtons hasPhoto={false} label="Add photo" variant="btn-photo-add" testId="photo" onSelect={() => {}} openUp />);
  openMenu();
  expect(document.querySelector('.photo-input-menu')).toHaveClass('photo-input-menu-up');
});
