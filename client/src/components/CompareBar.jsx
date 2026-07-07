import { useNavigate } from 'react-router-dom';
import './BulkEditBar.css';

export default function CompareBar({ category, selectedIds, onCancel }) {
  const navigate = useNavigate();
  const [a, b] = [...selectedIds];

  return (
    <div className="bulk-edit-bar" data-testid="compare-bar">
      <span className="bulk-edit-count">2 entries selected</span>
      <button
        type="button"
        className="bulk-edit-btn"
        onClick={() => navigate(`/compare?category=${category}&a=${a}&b=${b}`)}
      >
        Compare
      </button>
      <button type="button" className="bulk-edit-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}
