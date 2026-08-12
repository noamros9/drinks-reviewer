import { formatPrice } from '../../utils/analyticsHelpers';
import { usePagination } from '../../hooks/usePagination';
import Pager from '../../components/Pager';
import './ConsistencyLeaderboard.css';

export default function RebuyLeaderboard({ rows, adminUrl }) {
  const { pageRows, page, totalPages, setPage } = usePagination(rows);

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
          {pageRows.map(r => (
            <tr key={r.id}>
              <td>
                <a href={adminUrl(r)} target="_blank" rel="noopener noreferrer" className="consistency-leaderboard-link">
                  {r.label}
                </a>
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
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
