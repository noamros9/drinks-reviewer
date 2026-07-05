import './ConsistencyLeaderboard.css';

export default function BestOfLeaderboard({ rows, onSelectDrink }) {
  if (rows.length === 0) return <p className="empty-state">No rated drinks yet.</p>;

  return (
    <div className="consistency-leaderboard-table">
      <table>
        <thead>
          <tr>
            <th>Drink</th>
            <th>Category</th>
            <th>Avg Rating</th>
            <th>Weighted Rating</th>
            <th>Tastings</th>
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
              <td>{r.avgRating}</td>
              <td>{r.weightedRating}</td>
              <td>{r.tastingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
