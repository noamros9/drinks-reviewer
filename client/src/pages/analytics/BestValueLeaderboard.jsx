import './ConsistencyLeaderboard.css';

export default function BestValueLeaderboard({ rows, onSelectDrink }) {
  if (rows.length === 0) return <p className="empty-state">No priced drinks yet.</p>;

  return (
    <div className="consistency-leaderboard-table" data-testid="best-value-table">
      <table>
        <thead>
          <tr>
            <th>Drink</th>
            <th>Category</th>
            <th>Avg Price</th>
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
              </td>
              <td>{r.category.charAt(0).toUpperCase() + r.category.slice(1)}</td>
              <td>{r.price}</td>
              <td>{r.weightedRating}</td>
              <td>{r.valueScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
