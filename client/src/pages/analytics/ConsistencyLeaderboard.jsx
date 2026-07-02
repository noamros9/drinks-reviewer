import './ConsistencyLeaderboard.css';

function LeaderboardTable({ title, entries, onSelectDrink }) {
  return (
    <div className="consistency-leaderboard-table">
      <h4>{title}</h4>
      {entries.length === 0
        ? <p className="empty-state">No drinks with more than one tasting yet.</p>
        : (
          <table>
            <thead>
              <tr>
                <th>Drink</th>
                <th>Category</th>
                <th>Std Dev</th>
                <th>Tastings</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td>
                    <button type="button" className="consistency-leaderboard-link" onClick={() => onSelectDrink(e)}>
                      {e.label}
                    </button>
                  </td>
                  <td>{e.category.charAt(0).toUpperCase() + e.category.slice(1)}</td>
                  <td>{e.stdDev.toFixed(2)}</td>
                  <td>{e.tastingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

export default function ConsistencyLeaderboard({ mostConsistent, leastConsistent, onSelectDrink }) {
  return (
    <div className="consistency-leaderboard">
      <LeaderboardTable title="Most Consistent" entries={mostConsistent} onSelectDrink={onSelectDrink} />
      <LeaderboardTable title="Least Consistent" entries={leastConsistent} onSelectDrink={onSelectDrink} />
    </div>
  );
}
