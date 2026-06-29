import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { parse, format, isValid } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import './AdminPage.css';

const FIELDS = {
  wine: [
    { key: 'producer',      label: 'Producer',              type: 'text' },
    { key: 'seriesAndName', label: 'Series & Name',          type: 'text' },
    { key: 'wineCategory',  label: 'Wine Type',              type: 'select', options: ['Red', 'White', 'Rosé', 'Sparkling', 'Fortified'] },
    { key: 'variety',       label: 'Variety',                type: 'text' },
    { key: 'sweetness',     label: 'Sweetness',              type: 'select', options: ['Dry', 'Off-Dry', 'Sweet', 'Extra-Dry'] },
    { key: 'country',       label: 'Country of Origin',      type: 'text' },
    { key: 'region',        label: 'Region / Appellation',   type: 'text' },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'lastTasted',    label: 'Last Tasted',            type: 'date' },
    { key: 'lastRanking',   label: 'Last Ranking (1–10)',    type: 'number' },
    { key: 'avgRanking',    label: 'Avg Ranking (1–10)',     type: 'number' },
    { key: 'notionLink',    label: 'Notion Link',            type: 'url' },
    { key: 'tags',          label: 'Tags',                   type: 'tags', default: [] },
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
    { key: 'tags',        label: 'Tags',                   type: 'tags', default: [] },
  ],
  whiskey: [
    { key: 'distillery',  label: 'Distillery',             type: 'text' },
    { key: 'name',        label: 'Name',                   type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text' },
    { key: 'region',      label: 'Region',                 type: 'text', placeholder: 'Speyside, Islay, Highlands…' },
    { key: 'age',         label: 'Age (years)',             type: 'number' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'lastTasted',  label: 'Last Tasted',            type: 'date' },
    { key: 'lastRanking', label: 'Last Ranking (1–10)',    type: 'number' },
    { key: 'avgRanking',  label: 'Avg Ranking (1–10)',     type: 'number' },
    { key: 'notionLink',  label: 'Notion Link',            type: 'url' },
    { key: 'tags',        label: 'Tags',                   type: 'tags', default: [] },
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
    { key: 'tags',          label: 'Tags',                   type: 'tags', default: [] },
  ],
};

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

function emptyForm(category) {
  return Object.fromEntries(FIELDS[category].map(f => [f.key, f.default ?? '']));
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
  const [lots, setLots] = useState(editState?.drink?.collection ?? []);
  const [newLotQty, setNewLotQty] = useState('1');
  const [newLotPrice, setNewLotPrice] = useState('');
  const [collectionMessage, setCollectionMessage] = useState('');
  const [activeTab, setActiveTab] = useState('review');
  const drankIt = editState?.drankIt ?? false;
  const [tagInput, setTagInput] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [colCat, setColCat] = useState('wine');
  const [colForm, setColForm] = useState({ producer: '', name: '', country: '', abv: '', qty: '1', price: '' });
  const [colMessage, setColMessage] = useState('');

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(data => { if (Array.isArray(data)) setAllTags(data); }).catch(() => {});
  }, []);

  const addTag = (key, tag) => {
    if (!tag || (form[key] || []).includes(tag)) return;
    setForm(prev => ({ ...prev, [key]: [...(prev[key] || []), tag] }));
  };

  const removeTag = (key, tag) => {
    setForm(prev => ({ ...prev, [key]: prev[key].filter(t => t !== tag) }));
  };

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
    const body = drankIt ? { ...form, collectionOnly: false } : form;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage('Save failed. Please try again.');
      return;
    }
    if (drankIt && editState.lot) {
      await fetch(`/api/${category}/${form.id}/collection/${editState.lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: editState.lot.quantity - 1 }),
      });
      navigate('/collection');
      return;
    }
    if (!isEditing) {
      setForm(emptyForm(category));
    }
    setMessage(isEditing ? 'Entry updated!' : 'Entry added!');
  };

  const handleAddLot = async () => {
    const qty = parseInt(newLotQty, 10);
    if (!qty || qty < 1) return;
    const body = { quantity: qty };
    if (newLotPrice !== '') body.price = parseFloat(newLotPrice);
    const res = await fetch(`/api/${category}/${form.id}/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setCollectionMessage('Failed to add lot.'); return; }
    const newLot = await res.json();
    setLots(prev => [...prev, newLot]);
    setNewLotQty('1');
    setNewLotPrice('');
    setCollectionMessage('Lot added!');
  };

  const handleDeleteLot = async (lotId) => {
    const res = await fetch(`/api/${category}/${form.id}/collection/${lotId}`, { method: 'DELETE' });
    if (!res.ok) { setCollectionMessage('Failed to remove lot.'); return; }
    setLots(prev => prev.filter(l => l.id !== lotId));
    setCollectionMessage('Lot removed.');
  };

  const handleAddToCollection = async () => {
    const producerKey = { wine: 'producer', beer: 'brewery', whiskey: 'distillery', others: 'distillery' }[colCat];
    const nameKey = colCat === 'wine' ? 'seriesAndName' : 'name';
    const drinkRes = await fetch(`/api/${colCat}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [producerKey]: colForm.producer, [nameKey]: colForm.name, country: colForm.country, abv: colForm.abv, collectionOnly: true }),
    });
    if (!drinkRes.ok) { setColMessage('Failed to add drink.'); return; }
    const drink = await drinkRes.json();
    const qty = parseInt(colForm.qty, 10);
    if (qty >= 1) {
      const lotBody = { quantity: qty };
      if (colForm.price !== '') lotBody.price = parseFloat(colForm.price);
      await fetch(`/api/${colCat}/${drink.id}/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lotBody),
      });
    }
    navigate('/collection');
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this entry?')) return;
    const res = await fetch(`/api/${category}/${form.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage('Delete failed. Please try again.');
      return;
    }
    navigate(`/${category}`);
  };

  return (
    <div className="admin-page">
      <h1>{isEditing ? 'Edit Entry' : 'Add Entry'}</h1>

      <div className="category-tabs">
        <button className={activeTab === 'review' ? 'active' : ''} onClick={() => setActiveTab('review')}>Review</button>
        <button className={activeTab === 'collection' ? 'active' : ''} onClick={() => setActiveTab('collection')}>Collection</button>
      </div>

      {!isEditing && activeTab === 'review' && (
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

      {activeTab === 'review' && (
      <form onSubmit={handleSubmit} className="admin-form">
        {FIELDS[category].map(field => (
          <div key={field.key} className="form-group">
            <label htmlFor={field.key}>{field.label}</label>
            {field.type === 'date' ? (
              <DatePicker
                id={field.key}
                selected={(() => {
                  const d = parse(form[field.key] || '', 'dd/MM/yyyy', new Date());
                  return isValid(d) ? d : null;
                })()}
                onChange={(date) =>
                  setForm(prev => ({
                    ...prev,
                    [field.key]: date ? format(date, 'dd/MM/yyyy') : '',
                  }))
                }
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/yyyy"
                className="date-picker-input"
              />
            ) : field.type === 'tags' ? (
              <div className="tags-input">
                <div className="tags-chips">
                  {(form[field.key] || []).map(tag => (
                    <span key={tag} className="tag-chip">
                      {tag}
                      <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(field.key, tag)}>×</button>
                    </span>
                  ))}
                </div>
                <input
                  list="tags-datalist"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(field.key, tagInput.trim());
                      setTagInput('');
                    }
                  }}
                  placeholder="Type a tag and press Enter"
                />
                <datalist id="tags-datalist">
                  {allTags.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            ) : field.type === 'select' ? (
              <select
                id={field.key}
                name={field.key}
                value={form[field.key] ?? ''}
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
                value={form[field.key] ?? ''}
                onChange={handleChange}
                placeholder={field.placeholder || ''}
                min={field.type === 'number' ? 0 : undefined}
                max={field.key.includes('Ranking') ? 10 : undefined}
                step={field.key === 'avgRanking' ? '0.01' : field.type === 'number' ? '0.1' : undefined}
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
      )}

      {!isEditing && activeTab === 'collection' && (
        <div className="admin-form">
          <div className="category-tabs">
            {CATEGORIES.map(cat => (
              <button key={cat} className={colCat === cat ? 'active' : ''} onClick={() => setColCat(cat)}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          {[
            { key: 'producer', label: 'Producer', type: 'text' },
            { key: 'name',     label: 'Name',     type: 'text' },
            { key: 'country',  label: 'Country',  type: 'text' },
            { key: 'abv',      label: 'ABV (%)',  type: 'number' },
            { key: 'qty',      label: 'Quantity', type: 'number' },
            { key: 'price',    label: 'Price',    type: 'number', placeholder: 'Optional' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label htmlFor={`col-${f.key}`}>{f.label}</label>
              <input
                id={`col-${f.key}`}
                type={f.type}
                min={f.type === 'number' ? (f.key === 'qty' ? 1 : 0) : undefined}
                step={f.type === 'number' ? '0.1' : undefined}
                placeholder={f.placeholder || ''}
                value={colForm[f.key]}
                onChange={e => setColForm(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={handleAddToCollection}>Add to Collection</button>
          </div>
          {colMessage && <p className="success-message">{colMessage}</p>}
        </div>
      )}

      {isEditing && activeTab === 'collection' && (
        <section className="collection-section">
          <h2>My Collection</h2>
          <div className="lot-list">
            {lots.length === 0 && <p className="no-lots">No bottles in collection.</p>}
            {lots.map(lot => (
              <div key={lot.id} className="lot-row">
                <span className="lot-qty">Qty: {lot.quantity}</span>
                <span className="lot-price">Price: {lot.price ?? '—'}</span>
                <span className="lot-date">{lot.addedAt}</span>
                <button type="button" className="btn-danger btn-sm" onClick={() => handleDeleteLot(lot.id)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="add-lot-form">
            <div className="form-group">
              <label htmlFor="new-lot-qty">Quantity</label>
              <input id="new-lot-qty" type="number" min="1" value={newLotQty} onChange={e => setNewLotQty(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="new-lot-price">Price</label>
              <input id="new-lot-price" type="number" min="0" step="0.01" placeholder="Optional" value={newLotPrice} onChange={e => setNewLotPrice(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleAddLot}>Add to Collection</button>
          </div>
          {collectionMessage && <p className="success-message">{collectionMessage}</p>}
        </section>
      )}
    </div>
  );
}
