import { render, screen, fireEvent } from '@testing-library/react';
import DrinkTable from '../components/DrinkTable';

// A column header captures the pointer so it can be dragged to reorder. Capturing retargets the
// rest of the pointer sequence to the header, so a press that starts on the header's own "×"
// button never produces a click on that button: in a real browser the column was sorted instead
// of hidden. jsdom doesn't implement pointer capture, so only the capture itself can be asserted.
const DRINKS = [{ id: 'w1', producer: 'Yatir', seriesAndName: 'Darom', country: 'Israel' }];

function renderTable(onColumnLayoutChange = vi.fn()) {
  render(<DrinkTable category="wine" drinks={DRINKS} columnLayout={null} onColumnLayoutChange={onColumnLayoutChange} />);
  return onColumnLayoutChange;
}

describe('hiding a column from the header', () => {
  let capture;
  beforeEach(() => {
    capture = vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
  });
  afterEach(() => capture.mockRestore());

  it('does not capture the pointer when the press starts on the hide button', () => {
    renderTable();
    fireEvent.pointerDown(screen.getByTestId('col-hide-country'), { pointerId: 1 });
    expect(capture).not.toHaveBeenCalled();
  });

  it('still captures the pointer when the press starts on the header itself', () => {
    renderTable();
    fireEvent.pointerDown(document.querySelector('th[data-col-key="country"]'), { pointerId: 1 });
    expect(capture).toHaveBeenCalled();
  });

  it('hides the column without sorting by it', () => {
    const onChange = renderTable();
    fireEvent.pointerDown(screen.getByTestId('col-hide-country'), { pointerId: 1 });
    fireEvent.click(screen.getByTestId('col-hide-country'));
    expect([...onChange.mock.calls[0][0].hidden]).toEqual(['country']);
    expect(screen.queryByText(/Country ↑|Country ↓/)).not.toBeInTheDocument();
  });
});
