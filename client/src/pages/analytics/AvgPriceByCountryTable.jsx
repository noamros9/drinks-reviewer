import { useState } from 'react';

const COLUMNS = [
  { key: 'country', label: 'Country' },
  { key: 'avgPrice', label: 'Avg Price' },
  { key: 'count', label: 'Count' },
];

export default function AvgPriceByCountryTable({ rows, onSelectCountry }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (rows.length === 0) return <p className="empty-state">No country price data yet.</p>;

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    if (a[sortKey] === b[sortKey]) return 0;
    const sign = a[sortKey] < b[sortKey] ? -1 : 1;
    return sortDir === 'asc' ? sign : -sign;
  });

  return (
    <table className="country-ranking-table" data-testid="avg-price-country-table">
      <thead>
        <tr>
          {COLUMNS.map(col => (
            <th key={col.key} className="sortable" onClick={() => handleSort(col.key)}>
              {col.label}{sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(row => (
          <tr key={row.country} className="country-ranking-row" onClick={() => onSelectCountry(row.country)}>
            <td>{row.country}</td>
            <td>{row.avgPrice}</td>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
