export default function RangeFilterChips({ configs, values, onClear }) {
  return configs.map(conf => {
    const mn = values[`${conf.key}Min`] ?? '';
    const mx = values[`${conf.key}Max`] ?? '';
    if (mn === '' && mx === '') return null;
    return (
      <span key={`${conf.key}-chip`} className="filter-chip">
        {conf.label}: {mn !== '' ? mn : conf.min}–{mx !== '' ? mx : (conf.unbounded ? '∞' : conf.max)}
        <button onClick={() => onClear(conf.key)} aria-label={`Remove ${conf.label} filter`}>×</button>
      </span>
    );
  });
}
