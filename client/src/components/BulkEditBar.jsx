import { useState } from 'react';
import CustomSelect from './CustomSelect';
import { DROPDOWN_CONFIGS, buildDropdownOptions } from '../utils/filterHelpers';
import './BulkEditBar.css';

export default function BulkEditBar({ category, drinks, selectedIds, onApplied, onCancel }) {
  const bulkConfigs = DROPDOWN_CONFIGS[category].filter(c => !c.vintageFromTastings);
  const [fieldLabel, setFieldLabel] = useState(bulkConfigs[0]?.label ?? '');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');

  const activeConfig = bulkConfigs.find(c => c.label === fieldLabel) ?? bulkConfigs[0];
  const isTags = activeConfig?.key === 'tags';
  const { options: suggestions } = buildDropdownOptions(drinks, activeConfig);
  const count = selectedIds.size;
  const countLabel = `${count} ${count === 1 ? 'entry' : 'entries'}`;

  const apply = async (tagAction) => {
    const verb = isTags
      ? (tagAction === 'add' ? `Add tag "${value}" to` : `Remove tag "${value}" from`)
      : `Set ${activeConfig.label} to "${value}" for`;
    if (!window.confirm(`${verb} ${countLabel}?`)) return;
    const res = await fetch(`/api/${category}/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], field: activeConfig.key, value, ...(isTags ? { tagAction } : {}) }),
    });
    if (!res.ok) { setMessage('Bulk edit failed. Please try again.'); return; }
    const { updated } = await res.json();
    setValue('');
    setMessage('');
    onApplied(updated);
  };

  return (
    <div className="bulk-edit-bar" data-testid="bulk-edit-bar">
      <span className="bulk-edit-count">{countLabel} selected</span>
      <CustomSelect
        value={fieldLabel}
        onChange={label => { setFieldLabel(label); setValue(''); }}
        options={bulkConfigs.map(c => c.label)}
      />
      <input
        list="bulk-edit-datalist"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={isTags ? 'Tag' : activeConfig?.label}
        className="bulk-edit-value-input"
        data-testid="bulk-edit-value"
      />
      <datalist id="bulk-edit-datalist">
        {suggestions.map(s => <option key={s} value={s} />)}
      </datalist>
      {isTags ? (
        <>
          <button type="button" className="bulk-edit-btn" disabled={!value} onClick={() => apply('add')}>Add to {count}</button>
          <button type="button" className="bulk-edit-btn bulk-edit-btn-danger" disabled={!value} onClick={() => apply('remove')}>Remove from {count}</button>
        </>
      ) : (
        <button type="button" className="bulk-edit-btn" disabled={!value} onClick={() => apply()}>Apply to {count}</button>
      )}
      <button type="button" className="bulk-edit-cancel" onClick={onCancel}>Cancel</button>
      {message && <span className="bulk-edit-message">{message}</span>}
    </div>
  );
}
