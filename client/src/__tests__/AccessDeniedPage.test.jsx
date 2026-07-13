import { render, screen } from '@testing-library/react';
import AccessDeniedPage from '../pages/AccessDeniedPage';

test('renders the access-denied message and a retry link', () => {
  render(<AccessDeniedPage />);
  expect(screen.getByText('Access denied')).toBeInTheDocument();
  expect(screen.getByText(/isn't authorized for this site/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Try a different account' })).toHaveAttribute('href', '/auth/google');
});
