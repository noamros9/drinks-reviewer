export default function RegionLeaderboard({ rows }) {
  if (rows.length === 0) return <p className="empty-state">No regions match this filter.</p>;

  return (
    <table className="region-leaderboard-table">
      <thead>
        <tr>
          <th>Country</th>
          <th>Region</th>
          <th>Avg Rating</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={`${row.category}||${row.country}||${row.region}`}>
            <td>{row.country}</td>
            <td>{row.region}</td>
            <td>{row.avgRating}</td>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
