import { Link } from 'react-router-dom';
import './PublicDrinkList.css';

export default function PublicDrinkList({ entries }) {
  if (!entries.length) return <p className="empty-state">No shared drinks yet.</p>;

  return (
    <ul className="public-drink-list" data-testid="public-drink-list">
      {entries.map(entry => (
        <li key={`${entry.category}-${entry.id}`}>
          <Link to={`/share/${entry.category}/${entry.id}`} className="public-drink-card">
            {entry.photo
              ? <img src={entry.photo} alt="" className="public-drink-photo" />
              : <div className="public-drink-photo public-drink-photo-empty" aria-hidden="true" />}
            <div className="public-drink-info">
              <span className="public-drink-name">{entry.producer} — {entry.name}</span>
              <span className="public-drink-meta">
                {entry.category}
                {entry.avgRating != null && ` · ${entry.avgRating}/10`}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
