import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const FIELDS = {
  wine: [
    { key: 'producer',      label: 'Producer',              type: 'text' },
    { key: 'seriesAndName', label: 'Series & Name',          type: 'text' },
    { key: 'wineCategory',  label: 'Wine Type',              type: 'select', options: ['Red', 'White', 'Rosé', 'Sparkling'] },
    { key: 'variety',       label: 'Variety',                type: 'text' },
    { key: 'country',       label: 'Country of Origin',      type: 'text' },
    { key: 'region',        label: 'Region / Appellation',   type: 'text' },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'lastTasted',    label: 'Last Tasted',            type: 'date' },
    { key: 'lastRanking',   label: 'Last Ranking (1–10)',    type: 'number' },
    { key: 'avgRanking',    label: 'Avg Ranking (1–10)',     type: 'number' },
    { key: 'notionLink',    label: 'Notion Link',            type: 'url' },
  ],
  beer: [
    { key: 'brewery',     label: 'Brewery',               type: 'text' },
    { key: 'name',        label: 'Beer Name',              type: 'text' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text' },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'lastTasted',  label: 'Last Tasted',            type: 'date' },
    { key: 'lastRanking', label: 'Last Ranking (1–10)',    type: 'number' },
    { key: 'avgRanking',  label: 'Avg Ranking (1–10)',     type: 'number' },
    { key: 'notionLink',  label: 'Notion Link',            type: 'url' },
  ],
  whiskey: [
    { key: 'distillery',  label: 'Distillery',             type: 'text' },
    { key: 'name',        label: 'Name',                   type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text' },
    { key: 'age',         label: 'Age (years)',             type: 'number' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'lastTasted',  label: 'Last Tasted',            type: 'date' },
    { key: 'lastRanking', label: 'Last Ranking (1–10)',    type: 'number' },
    { key: 'avgRanking',  label: 'Avg Ranking (1–10)',     type: 'number' },
    { key: 'notionLink',  label: 'Notion Link',            type: 'url' },
  ],
  others: [
    { key: 'drinkCategory', label: 'Drink Category',         type: 'text', placeholder: 'Rum, Vodka, Liqueur…' },
    { key: 'distillery',    label: 'Distillery',             type: 'text' },
    { key: 'name',          label: 'Name',                   type: 'text' },
    { key: 'country',       label: 'Country of Origin',      type: 'text' },
    { key: 'style',         label: 'Style',                  type: 'text' },
    { key: 'age',           label: 'Age (years)',             type: 'number' },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'lastTasted',    label: 'Last Tasted',            type: 'date' },
    { key: 'lastRanking',   label: 'Last Ranking (1–10)',    type: 'number' },
    { key: 'avgRanking',    label: 'Avg Ranking (1–10)',     type: 'number' },
    { key: 'notionLink',    label: 'Notion Link',            type: 'url' },
  ],
};

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

function emptyForm(category) {
  return Object.fromEntries(FIELDS[category].map(f => [f.key, '']));
}

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const editState = location.state;

  const [category, setCategory] = useState(editState?.category || 'wine');
  const [form, setForm] = useState(
    editState?.drink ? { ...editState.drink } : emptyForm(editState?.category || 'wine')
  );
  const isEditing = !!editState?.drink;
  const [message, setMessage] = useState('');

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setForm(emptyForm(cat));
    setMessage('');
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditing ? `/api/${category}/${form.id}` : `/api/${category}`;
    const method = isEditing ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!isEditing) {
      setForm(emptyForm(category));
    }
    setMessage(isEditing ? 'Entry updated!' : 'Entry added!');
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this entry?')) return;
    await fetch(`/api/${category}/${form.id}`, { method: 'DELETE' });
    navigate(`/${category}`);
  };

  return (
    <div className="admin-page">
      <h1>{isEditing ? 'Edit Entry' : 'Add Entry'}</h1>

      {!isEditing && (
        <div className="category-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={category === cat ? 'active' : ''}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admin-form">
        {FIELDS[category].map(field => (
          <div key={field.key} className="form-group">
            <label htmlFor={field.key}>{field.label}</label>
            {field.type === 'select' ? (
              <select
                id={field.key}
                name={field.key}
                value={form[field.key] || ''}
                onChange={handleChange}
              >
                <option value="">Select…</option>
                {field.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                id={field.key}
                type={field.type}
                name={field.key}
                value={form[field.key] || ''}
                onChange={handleChange}
                placeholder={field.placeholder || ''}
                min={field.type === 'number' ? 0 : undefined}
                max={field.key.includes('Ranking') ? 10 : undefined}
                step={field.type === 'number' ? '0.1' : undefined}
              />
            )}
          </div>
        ))}

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {isEditing ? 'Update' : 'Add'}
          </button>
          {isEditing && (
            <button type="button" className="btn-danger" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>

        {message && <p className="success-message">{message}</p>}
      </form>
    </div>
  );
}
