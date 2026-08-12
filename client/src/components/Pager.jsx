import './Pager.css';

export default function Pager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pager">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>Prev</button>
      <span className="pager-status">Page {page} of {totalPages}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Next</button>
    </div>
  );
}
