import './ConsistencyLeaderboard.css';

function LeaderboardTable({ title, entries, onSelectProducer }) {
  return (
    <div className="consistency-leaderboard-table">
      <h4>{title}</h4>
      {entries.length === 0
        ? <p className="empty-state">No producers with more than one drink yet.</p>
        : (
          <table>
            <thead>
              <tr>
                <th>Producer</th>
                <th>Std Dev</th>
                <th>Drinks</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.producer}>
                  <td>
                    <button type="button" className="consistency-leaderboard-link" onClick={() => onSelectProducer(e.producer)}>
                      {e.producer}
                    </button>
                  </td>
                  <td>{e.stdDev.toFixed(2)}</td>
                  <td>{e.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

export default function ProducerConsistencyTable({ data, onSelectProducer }) {
  return (
    <div className="consistency-leaderboard">
      <LeaderboardTable title="Most Consistent" entries={data.mostConsistent} onSelectProducer={onSelectProducer} />
      <LeaderboardTable title="Least Consistent" entries={data.leastConsistent} onSelectProducer={onSelectProducer} />
    </div>
  );
}
