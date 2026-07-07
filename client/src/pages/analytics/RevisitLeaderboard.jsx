import './ConsistencyLeaderboard.css';

export default function RevisitLeaderboard({ rows, onSelectDrink }) {
  if (rows.length === 0) return <p className="empty-state">Nothing to revisit.</p>;

  return (
    <div className="consistency-leaderboard-table" data-testid="revisit-table">
      <table>
        <thead>
          <tr>
            <th>Drink</th>
            <th>Category</th>
            <th>Avg Rating</th>
            <th>Last Tasted</th>
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
              <td>{r.lastTasted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
