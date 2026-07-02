import './StatTileRow.css';

export default function StatTileRow({ tiles }) {
  return (
    <div className="stat-tile-row">
      {tiles.map(({ label, value, onClick }) => {
        const Tag = onClick ? 'button' : 'div';
        return (
          <Tag key={label} type={onClick ? 'button' : undefined} className={`stat-tile${onClick ? ' stat-tile-clickable' : ''}`} onClick={onClick}>
            <span className="stat-tile-value">{value}</span>
            <span className="stat-tile-label">{label}</span>
          </Tag>
        );
      })}
    </div>
  );
}
