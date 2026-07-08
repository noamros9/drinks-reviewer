import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import CustomSelect from '../components/CustomSelect';
import AutocompleteInput from '../components/AutocompleteInput';
import './AdminPage.css';

export const FIELDS = {
  wine: [
    { key: 'producer',      label: 'Producer',              type: 'text', autocomplete: true },
    { key: 'seriesAndName', label: 'Series & Name',          type: 'text' },
    { key: 'wineCategory',  label: 'Wine Type',              type: 'select', options: ['Red', 'White', 'Rosé', 'Sparkling', 'Fortified'] },
    { key: 'variety',       label: 'Variety',                type: 'text', autocomplete: true },
    { key: 'sweetness',     label: 'Sweetness',              type: 'select', options: ['Extra-Dry', 'Dry', 'Off-Dry', 'Sweet'] },
    { key: 'country',       label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'region',        label: 'Region / Appellation',   type: 'text', autocomplete: true },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'vivinoScore',   label: 'Vivino Score',           type: 'number', min: 1, max: 5, step: 0.1, placeholder: 'e.g. 4.2' },
    { key: 'tags',          label: 'Tags',                   type: 'tags', default: [] },
  ],
  beer: [
    { key: 'brewery',     label: 'Brewery',               type: 'text', autocomplete: true },
    { key: 'name',        label: 'Beer Name',              type: 'text' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'tags',        label: 'Tags',                   type: 'tags', default: [] },
  ],
  whiskey: [
    { key: 'distillery',  label: 'Distillery',             type: 'text', autocomplete: true },
    { key: 'name',        label: 'Name',                   type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'region',      label: 'Region',                 type: 'text', placeholder: 'Speyside, Islay, Highlands…', autocomplete: true },
    { key: 'age',         label: 'Age (years)',             type: 'number' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'tags',        label: 'Tags',                   type: 'tags', default: [] },
  ],
  others: [
    { key: 'drinkCategory', label: 'Drink Category',         type: 'text', placeholder: 'Rum, Vodka, Liqueur…' },
    { key: 'distillery',    label: 'Distillery',             type: 'text', autocomplete: true },
    { key: 'name',          label: 'Name',                   type: 'text' },
    { key: 'country',       label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'style',         label: 'Style',                  type: 'text' },
    { key: 'age',           label: 'Age (years)',             type: 'number' },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'tags',          label: 'Tags',                   type: 'tags', default: [] },
  ],
};

const CATEGORIES = ['wine', 'beer', 'whiskey', 'others'];

// Deleting the last tasting clears these server-side rather than setting them to null,
// so a plain spread wouldn't remove stale values already in form.
const DERIVED_TASTING_FIELDS = ['avgRating', 'lastRating', 'lastTasted', 'tastingCount', 'vintage'];

function emptyForm(category) {
  return Object.fromEntries(FIELDS[category].map(f => [f.key, f.default ?? '']));
}


export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editState = location.state;

  const initialCategory = editState?.category || searchParams.get('category');
  const [category, setCategory] = useState(CATEGORIES.includes(initialCategory) ? initialCategory : 'wine');
  const [form, setForm] = useState(
    editState?.drink ? { ...editState.drink } : emptyForm(editState?.category || 'wine')
  );
  const deepLinkId = searchParams.get('id');
  const [loadingDrink, setLoadingDrink] = useState(!!deepLinkId && !editState?.drink);
  const isEditing = !!form.id || (loadingDrink && !!deepLinkId);
  const [message, setMessage] = useState('');
  const [lots, setLots] = useState(editState?.drink?.collection ?? []);
  const [newLotQty, setNewLotQty] = useState('1');
  const [newLotPrice, setNewLotPrice] = useState('');
  const [collectionMessage, setCollectionMessage] = useState('');
  const [activeTab, setActiveTab] = useState(editState?.tab || 'review');
  const drankIt = editState?.drankIt ?? false;
  const [tagInput, setTagInput] = useState('');
  const [tastings, setTastings] = useState(editState?.drink?.tastings ?? []);
  const [newTastingDate, setNewTastingDate] = useState(null);
  const [newTastingRating, setNewTastingRating] = useState('');
  const [newTastingVintage, setNewTastingVintage] = useState('');
  const [tastingsMessage, setTastingsMessage] = useState('');
  const [editingTastingId, setEditingTastingId] = useState(null);
  const [newTastingImage, setNewTastingImage] = useState(null);
  const newTastingImageRef = useRef(null);
  const [editTastingForm, setEditTastingForm] = useState({});
  const [allTags, setAllTags] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [colCat, setColCat] = useState('wine');
  const [colForm, setColForm] = useState({ producer: '', name: '', country: '', abv: '', qty: '1', price: '' });
  const [colMessage, setColMessage] = useState('');
  const [focusVivino, setFocusVivino] = useState(false);
  const vivinoInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(data => { if (Array.isArray(data)) setAllTags(data); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!focusVivino || !vivinoInputRef.current) return;
    vivinoInputRef.current.focus();
    vivinoInputRef.current.select();
    setFocusVivino(false);
  }, [focusVivino]);

  const idLookupDone = useRef(!deepLinkId || !!editState?.drink);

  useEffect(() => {
    const keys = FIELDS[category].filter(f => f.autocomplete).map(f => f.key);
    fetch(`/api/${category}`).then(r => r.json()).then(drinks => {
      if (!Array.isArray(drinks)) return;
      const map = {};
      keys.forEach(k => {
        map[k] = [...new Set(drinks.map(d => d[k]).filter(Boolean))].sort();
      });
      setSuggestions(map);

      if (!idLookupDone.current) {
        idLookupDone.current = true;
        const drink = drinks.find(d => d.id === deepLinkId);
        if (drink) {
          setForm({ ...drink });
          setLots(drink.collection ?? []);
          setTastings(drink.tastings ?? []);
          if (category === 'wine') setFocusVivino(true);
        }
        setLoadingDrink(false);
      }
    }).catch(() => { if (!idLookupDone.current) { idLookupDone.current = true; setLoadingDrink(false); } });
  }, [category]);

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
      const newDrink = await res.json();
      navigate('/admin', { state: { drink: newDrink, category, tab: 'tastings' } });
      return;
    }
    setMessage('Entry updated!');
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
    navigate('/admin', { state: { drink, category: colCat, tab: 'tastings' } });
  };

  const syncFormFromDrink = (updated) => {
    setForm(prev => ({
      ...prev,
      ...Object.fromEntries(DERIVED_TASTING_FIELDS.map(k => [k, undefined])),
      ...updated,
    }));
  };

  const handleAddTasting = async () => {
    if (!newTastingDate || !newTastingRating) return;
    const body = { date: format(newTastingDate, 'dd/MM/yyyy'), rating: Number(newTastingRating) };
    if (category === 'wine' && newTastingVintage) body.vintage = newTastingVintage;
    const res = await fetch(`/api/${category}/${form.id}/tastings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setTastingsMessage('Failed to add tasting.'); return; }
    const updated = await res.json();

    const imageFile = newTastingImageRef.current;
    newTastingImageRef.current = null;
    setNewTastingImage(null);
    setNewTastingDate(null);
    setNewTastingRating('');
    setNewTastingVintage('');
    setTastings(updated.tastings);
    syncFormFromDrink(updated);
    setTastingsMessage('Tasting added!');

    if (imageFile) {
      const newTastingId = updated.tastings.at(-1).id;
      const fd = new FormData();
      fd.append('image', imageFile);
      const imgRes = await fetch(`/api/${category}/${form.id}/tastings/${newTastingId}/image`, { method: 'POST', body: fd });
      if (!imgRes.ok) { setTastingsMessage('Failed to upload image.'); return; }
      const imgUpdated = await imgRes.json();
      const imageUrl = imgUpdated.tastings?.find(t => t.id === newTastingId)?.imageUrl;
      if (imageUrl) {
        setTastings(prev => prev.map(t => t.id === newTastingId ? { ...t, imageUrl } : t));
      }
    }
  };

  const handleTastingImage = async (tastingId, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`/api/${category}/${form.id}/tastings/${tastingId}/image`, { method: 'POST', body: fd });
    if (!res.ok) { setTastingsMessage('Failed to upload image.'); return; }
    const updated = await res.json();
    setTastings(updated.tastings);
  };

  const handleDeleteTasting = async (tastingId) => {
    const res = await fetch(`/api/${category}/${form.id}/tastings/${tastingId}`, { method: 'DELETE' });
    if (!res.ok) { setTastingsMessage('Failed to remove tasting.'); return; }
    const updated = await res.json();
    setTastings(updated.tastings);
    syncFormFromDrink(updated);
    setTastingsMessage('Tasting removed.');
  };

  const startEditTasting = (t) => {
    setEditingTastingId(t.id);
    setEditTastingForm({ date: t.date, rating: String(t.rating), vintage: t.vintage || '' });
  };

  const handleSaveTasting = async (tastingId) => {
    const body = { date: editTastingForm.date, rating: Number(editTastingForm.rating) };
    if (category === 'wine' && editTastingForm.vintage) body.vintage = editTastingForm.vintage;
    const res = await fetch(`/api/${category}/${form.id}/tastings/${tastingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setTastingsMessage('Failed to update tasting.'); return; }
    const updated = await res.json();
    setTastings(updated.tastings);
    syncFormFromDrink(updated);
    setEditingTastingId(null);
    setTastingsMessage('Tasting updated!');
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
        {isEditing && <button className={activeTab === 'tastings' ? 'active' : ''} onClick={() => setActiveTab('tastings')}>Tastings</button>}
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
            {field.type === 'tags' ? (
              <div className="tags-input">
                <div className="tags-chips">
                  {(form[field.key] || []).map(tag => (
                    <span key={tag} className="tag-chip">
                      {tag}
                      <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(field.key, tag)}>×</button>
                    </span>
                  ))}
                </div>
                <AutocompleteInput
                  name="tagInput"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(field.key, tagInput.trim());
                      setTagInput('');
                    }
                  }}
                  suggestions={allTags}
                  placeholder="Type a tag and press Enter"
                />
              </div>
            ) : field.type === 'select' ? (
              <CustomSelect
                id={field.key}
                value={form[field.key] ?? ''}
                onChange={val => setForm(prev => ({ ...prev, [field.key]: val }))}
                options={field.options}
              />
            ) : field.autocomplete ? (
              <AutocompleteInput
                id={field.key}
                name={field.key}
                value={form[field.key] ?? ''}
                onChange={handleChange}
                suggestions={suggestions[field.key] || []}
                placeholder={field.placeholder || ''}
              />
            ) : (
              <input
                id={field.key}
                type={field.type}
                name={field.key}
                value={form[field.key] ?? ''}
                onChange={handleChange}
                placeholder={field.placeholder || ''}
                min={field.type === 'number' ? (field.min ?? 0) : undefined}
                max={field.type === 'number' ? field.max : undefined}
                step={field.type === 'number' ? (field.step ?? 0.1) : undefined}
                ref={field.key === 'vivinoScore' ? vivinoInputRef : undefined}
              />
            )}
          </div>
        ))}

        {isEditing && (form.lastTasted || form.lastRating != null || form.avgRating != null) && (
          <div className="derived-fields">
            {form.lastTasted   && <div className="form-group"><label>Last Tasted</label><input readOnly value={form.lastTasted} className="input-readonly" /></div>}
            {form.lastRating != null && form.lastRating !== '' && <div className="form-group"><label>Last Rating</label><input readOnly value={form.lastRating} className="input-readonly" /></div>}
            {form.avgRating  != null && form.avgRating  !== '' && <div className="form-group"><label>Avg Rating</label><input readOnly value={form.avgRating}  className="input-readonly" /></div>}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loadingDrink}>
            {isEditing ? 'Update' : 'Add'}
          </button>
          {isEditing && (
            <button type="button" className="btn-danger" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>

        {loadingDrink && <p className="success-message">Loading entry…</p>}
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
      {isEditing && activeTab === 'tastings' && (
        <section className="collection-section tastings-section">
          <div className="tastings-main">
          <h2>Tasting History</h2>
          <div className="lot-list">
            {tastings.length === 0 && <p className="no-lots">No tastings recorded.</p>}
            {[...tastings].reverse().map(t => (
              <div key={t.id} className="lot-row">
                {t.imageUrl
                  ? <img src={t.imageUrl} alt="" className="tasting-thumb" data-testid={`tasting-img-${t.id}`} />
                  : <div className="tasting-thumb-placeholder" data-testid={`tasting-placeholder-${t.id}`} />}
                {editingTastingId === t.id ? (
                  <>
                    <input
                      type="text"
                      data-testid="edit-tasting-date"
                      className="tasting-inline-input"
                      value={editTastingForm.date}
                      onChange={e => setEditTastingForm(f => ({ ...f, date: e.target.value }))}
                      placeholder="dd/mm/yyyy"
                    />
                    <input
                      type="number"
                      min="1" max="10" step="0.5"
                      data-testid="edit-tasting-rating"
                      className="tasting-inline-input tasting-inline-rating"
                      value={editTastingForm.rating}
                      onChange={e => setEditTastingForm(f => ({ ...f, rating: e.target.value }))}
                    />
                    {category === 'wine' && (
                      <input
                        type="text"
                        data-testid="edit-tasting-vintage"
                        className="tasting-inline-input tasting-inline-vintage"
                        value={editTastingForm.vintage}
                        onChange={e => setEditTastingForm(f => ({ ...f, vintage: e.target.value }))}
                        placeholder="Vintage"
                      />
                    )}
                    <button type="button" className="btn-primary btn-sm" onClick={() => handleSaveTasting(t.id)}>Save</button>
                    <button type="button" className="btn-sm" onClick={() => setEditingTastingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span>{t.date}</span>
                    <span className="lot-qty">{t.rating}</span>
                    {category === 'wine' && <span className="tasting-vintage">{t.vintage || '—'}</span>}
                    <div className="tasting-row-actions">
                      <label className="btn-upload-img">
                        {t.imageUrl ? 'Change photo' : 'Add photo'}
                        <input type="file" accept="image/*" data-testid={`img-upload-${t.id}`} onChange={e => handleTastingImage(t.id, e.target.files[0])} />
                      </label>
                      <button type="button" className="btn-tasting-edit btn-sm" onClick={() => startEditTasting(t)}>Edit</button>
                      <button type="button" className="btn-danger btn-sm" onClick={() => handleDeleteTasting(t.id)}>Remove</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="add-lot-form">
            <div className="form-group">
              <label>Date</label>
              <DatePicker
                selected={newTastingDate}
                onChange={setNewTastingDate}
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/yyyy"
                className="date-picker-input"
              />
            </div>
            <div className="form-group">
              <label>Rating (1–10)</label>
              <input type="number" min="1" max="10" step="0.5" value={newTastingRating} onChange={e => setNewTastingRating(e.target.value)} />
            </div>
            {category === 'wine' && (
              <div className="form-group">
                <label>Vintage</label>
                <input type="text" placeholder="e.g. 2021" value={newTastingVintage} onChange={e => setNewTastingVintage(e.target.value)} />
              </div>
            )}
            <label
              className={`btn-photo-add${newTastingImage ? ' has-photo' : ''}`}
              title={newTastingImage ? newTastingImage.name : 'Add photo'}
            >
              {newTastingImage ? '📷 ✓' : '📷 +'}
              <input type="file" accept="image/*" data-testid="new-tasting-img" onChange={e => { const f = e.target.files[0] || null; newTastingImageRef.current = f; setNewTastingImage(f); }} />
            </label>
            <button type="button" className="btn-primary" onClick={handleAddTasting}>Add Tasting</button>
          </div>
          {tastingsMessage && <p className="success-message">{tastingsMessage}</p>}
          </div>
          {tastings.length > 0 && tastings[tastings.length - 1].imageUrl && (
            <div className="tastings-preview">
              <img src={tastings[tastings.length - 1].imageUrl} alt="" data-testid="tastings-preview-img" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
