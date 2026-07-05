import { useState } from 'react';

// ponytail: intentional near-duplicate of CountryRankingTable — one shared table would
// ripple into the shipped Geographic section + WorldMap; not worth the blast radius.
export default function StyleLeaderboardTable({ rows, label, onSelectStyle }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const columns = [
    { key: 'style', label },
    { key: 'avgRating', label: 'Avg Rating' },
    { key: 'count', label: 'Count' },
  ];

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (rows.length === 0) return <p className="empty-state">No {label.toLowerCase()} data yet.</p>;

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    if (a[sortKey] === b[sortKey]) return 0;
    const sign = a[sortKey] < b[sortKey] ? -1 : 1;
    return sortDir === 'asc' ? sign : -sign;
  });

  return (
    <table className="country-ranking-table" data-testid="style-leaderboard-table">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} className="sortable" onClick={() => handleSort(col.key)}>
              {col.label}{sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(row => (
          <tr
            key={row.style}
            className={onSelectStyle ? 'country-ranking-row' : ''}
            onClick={onSelectStyle ? () => onSelectStyle(row.style) : undefined}
          >
            <td>{row.style}</td>
            <td>{row.avgRating}</td>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
