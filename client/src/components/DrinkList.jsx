export default function DrinkList({ entries = [], linked, testId, emptyText }) {
  if (!entries.length) return emptyText ? <p className="empty-state">{emptyText}</p> : null;
  return (
    <ul className="recommend-list" data-testid={testId}>
      {entries.map((entry, i) => (
        <li key={i}>
          {linked
            ? <a href={entry.url} target="_blank" rel="noreferrer">{entry.name}</a>
            : entry.name}
          {entry.description && <span className="recommend-reason">{entry.description}</span>}
        </li>
      ))}
    </ul>
  );
}
