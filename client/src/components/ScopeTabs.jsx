export const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];

export default function ScopeTabs({ category, onChange, testId }) {
  return (
    <div className="category-tabs" data-testid={testId}>
      <span className="scope-label">Scope</span>
      {CATEGORY_FILTERS.map(c => (
        <button key={c} className={category === c ? 'active' : ''} onClick={() => onChange(c)}>
          {c.charAt(0).toUpperCase() + c.slice(1)}
        </button>
      ))}
    </div>
  );
}
