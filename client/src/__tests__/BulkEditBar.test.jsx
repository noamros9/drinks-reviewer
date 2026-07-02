import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkEditBar from '../components/BulkEditBar';

const DRINKS = [
  { id: '1', producer: 'A', region: 'Bordeaux', tags: ['gift'] },
  { id: '2', producer: 'B', region: 'Piedmont', tags: [] },
];

function renderBar(props = {}) {
  const onApplied = vi.fn();
  const onCancel = vi.fn();
  render(
    <BulkEditBar
      category="wine"
      drinks={DRINKS}
      selectedIds={new Set(['1', '2'])}
      onApplied={onApplied}
      onCancel={onCancel}
      {...props}
    />
  );
  return { onApplied, onCancel };
}

function openFieldMenu(currentLabel = 'Type') {
  fireEvent.click(screen.getByText(currentLabel));
}

beforeEach(() => {
  window.confirm = vi.fn(() => true);
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ updated: [] }) }));
});

test('shows the selected count', () => {
  renderBar();
  expect(screen.getByText('2 entries selected')).toBeInTheDocument();
});

test('field picker lists DROPDOWN_CONFIGS options for the category, excluding vintage', () => {
  renderBar();
  openFieldMenu();
  const optionLabels = [...document.querySelectorAll('.custom-select-menu li')].map(li => li.textContent);
  expect(optionLabels).toEqual(['Select…', 'Type', 'Sweetness', 'Country', 'Variety', 'Region', 'Tags']);
});

test('default field (non-tags) shows a single Apply button', () => {
  renderBar();
  expect(screen.getByRole('button', { name: /apply to 2/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /add to 2/i })).not.toBeInTheDocument();
});

test('selecting Tags shows Add/Remove buttons instead of Apply', () => {
  renderBar();
  openFieldMenu();
  fireEvent.mouseDown(screen.getByText('Tags'));
  expect(screen.getByRole('button', { name: /add to 2/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /remove from 2/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^apply to 2$/i })).not.toBeInTheDocument();
});

test('Apply is disabled until a value is entered', () => {
  renderBar();
  expect(screen.getByRole('button', { name: /apply to 2/i })).toBeDisabled();
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'Bordeaux' } });
  expect(screen.getByRole('button', { name: /apply to 2/i })).not.toBeDisabled();
});

test('Cancel calls onCancel', () => {
  const { onCancel } = renderBar();
  fireEvent.click(screen.getByText('Cancel'));
  expect(onCancel).toHaveBeenCalled();
});

test('declining the confirm dialog does not call fetch', () => {
  window.confirm = vi.fn(() => false);
  renderBar();
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'Bordeaux' } });
  fireEvent.click(screen.getByRole('button', { name: /apply to 2/i }));
  expect(global.fetch).not.toHaveBeenCalled();
});

test('confirming Apply PATCHes the bulk endpoint with the right body and calls onApplied', async () => {
  const updated = [{ id: '1', region: 'Rhone' }, { id: '2', region: 'Rhone' }];
  global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ updated }) });
  const { onApplied } = renderBar();
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'Rhone' } });
  fireEvent.click(screen.getByRole('button', { name: /apply to 2/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine/bulk', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ ids: ['1', '2'], field: 'wineCategory', value: 'Rhone' }),
  })));
  await waitFor(() => expect(onApplied).toHaveBeenCalledWith(updated));
});

test('confirming a tag Add sends tagAction "add"', async () => {
  renderBar();
  openFieldMenu();
  fireEvent.mouseDown(screen.getByText('Tags'));
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'organic' } });
  fireEvent.click(screen.getByRole('button', { name: /add to 2/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine/bulk', expect.objectContaining({
    body: JSON.stringify({ ids: ['1', '2'], field: 'tags', value: 'organic', tagAction: 'add' }),
  })));
});

test('confirming a tag Remove sends tagAction "remove"', async () => {
  renderBar();
  openFieldMenu();
  fireEvent.mouseDown(screen.getByText('Tags'));
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'gift' } });
  fireEvent.click(screen.getByRole('button', { name: /remove from 2/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/wine/bulk', expect.objectContaining({
    body: JSON.stringify({ ids: ['1', '2'], field: 'tags', value: 'gift', tagAction: 'remove' }),
  })));
});

test('shows an error message and does not call onApplied when the request fails', async () => {
  global.fetch.mockResolvedValue({ ok: false });
  const { onApplied } = renderBar();
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'Rhone' } });
  fireEvent.click(screen.getByRole('button', { name: /apply to 2/i }));
  await waitFor(() => expect(screen.getByText(/bulk edit failed/i)).toBeInTheDocument());
  expect(onApplied).not.toHaveBeenCalled();
});

test('switching fields resets the value input', () => {
  renderBar();
  fireEvent.change(screen.getByTestId('bulk-edit-value'), { target: { value: 'Bordeaux' } });
  openFieldMenu();
  fireEvent.mouseDown(screen.getByText('Country'));
  expect(screen.getByTestId('bulk-edit-value')).toHaveValue('');
});
