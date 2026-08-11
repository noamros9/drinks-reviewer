import { formatPrice } from '../../utils/analyticsHelpers';
import './ConsistencyLeaderboard.css';

export default function RebuyLeaderboard({ rows, onSelectDrink }) {
  if (rows.length === 0) return <p className="empty-state">No rebuy candidates — everything rated is still in stock.</p>;

  return (
    <div className="consistency-leaderboard-table" data-testid="rebuy-table">
      <table>
        <thead>
          <tr>
            <th>Drink</th>
            <th>Category</th>
            <th>Price</th>
            <th>Weighted Rating</th>
            <th>Value Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <button type="button" className="consistency-leaderboard-link" onClick={() => onSelectDrink(r)}>
                  {r.label}
                </button>
                {r.previouslyOwned && <span title="You've bought this before"> ↻</span>}
              </td>
              <td>{r.category.charAt(0).toUpperCase() + r.category.slice(1)}</td>
              <td>{formatPrice(r.price)}{r.priceIsEstimated ? ' (est.)' : ''}</td>
              <td>{r.weightedRating}</td>
              <td>{r.valueScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
