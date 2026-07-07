import { useNavigate } from 'react-router-dom';
import './BulkEditBar.css';

export default function CompareBar({ category, selectedIds, onCancel }) {
  const navigate = useNavigate();
  const count = selectedIds.size;

  return (
    <div className="bulk-edit-bar" data-testid="compare-bar">
      <span className="bulk-edit-count">{count} {count === 1 ? 'entry' : 'entries'} selected</span>
      <button
        type="button"
        className="bulk-edit-btn"
        onClick={() => navigate(`/compare?category=${category}&ids=${[...selectedIds].join(',')}`)}
      >
        Compare {count}
      </button>
      <button type="button" className="bulk-edit-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}
