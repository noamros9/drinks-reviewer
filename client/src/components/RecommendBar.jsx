import { useNavigate } from 'react-router-dom';
import './BulkEditBar.css';

export default function RecommendBar({ category, selectedIds, onCancel }) {
  const navigate = useNavigate();
  const count = selectedIds.size;

  const handleRecommend = () => {
    const seeds = [...selectedIds].map(id => `${id}:${category}`).join(',');
    navigate(`/recommend?seeds=${seeds}`);
  };

  return (
    <div className="bulk-edit-bar" data-testid="recommend-bar">
      <span className="bulk-edit-count">{count} {count === 1 ? 'entry' : 'entries'} selected</span>
      <button type="button" className="bulk-edit-btn" onClick={handleRecommend}>
        Recommend similar
      </button>
      <button type="button" className="bulk-edit-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}
