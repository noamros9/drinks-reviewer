import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { shift } from '@floating-ui/dom';
import { format } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import CustomSelect from '../components/CustomSelect';
import AutocompleteInput from '../components/AutocompleteInput';
import PhotoInputButtons from '../components/PhotoInputButtons';
import { PRODUCER_FIELD, NAME_FIELD, findDuplicate } from '../utils/filterHelpers';
import './AdminPage.css';

export const FIELDS = {
  wine: [
    { key: 'producer',      label: 'Producer',              type: 'text', autocomplete: true },
    { key: 'seriesAndName', label: 'Series & Name',          type: 'text' },
    { key: 'wineCategory',  label: 'Wine Type',              type: 'select', options: ['Red', 'White', 'Rosé', 'Sparkling', 'Fortified'] },
    { key: 'variety',       label: 'Variety',                type: 'tags', default: [] },
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

function parsePositiveInt(value) {
  return /^[1-9]\d*$/.test(String(value).trim()) ? parseInt(value, 10) : null;
}


export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editState = location.state;

  const initialCategory = editState?.category || searchParams.get('category');
  const [category, setCategory] = useState(CATEGORIES.includes(initialCategory) ? initialCategory : 'wine');
  const [form, setForm] = useState(() =>
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
  const [tagInputs, setTagInputs] = useState({});
  const tagInputRefs = useRef({});
  const getInputRef = key => (tagInputRefs.current[key] ??= { current: null });
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
  const [categoryDrinks, setCategoryDrinks] = useState([]);
  const duplicate = findDuplicate(categoryDrinks, category, form[PRODUCER_FIELD[category]], form[NAME_FIELD[category]], form.id);
  const [colCat, setColCat] = useState(CATEGORIES.includes(initialCategory) ? initialCategory : 'wine');
  const [colForm, setColForm] = useState({ producer: '', name: '', country: '', abv: '', qty: '1', price: '', tags: [] });
  const [colMessage, setColMessage] = useState('');
  const [colSuggestions, setColSuggestions] = useState({});
  const [newColImage, setNewColImage] = useState(null);
  const newColImageRef = useRef(null);
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
      setCategoryDrinks(drinks);

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

  useEffect(() => {
    if (isEditing) return;
    const producerKey = PRODUCER_FIELD[colCat];
    Promise.all([
      fetch(`/api/${colCat}`).then(r => r.json()),
      fetch('/api/collection').then(r => r.json()),
    ]).then(([reviewed, collection]) => {
      if (!Array.isArray(reviewed) || !Array.isArray(collection)) return;
      const collectionOnly = collection.filter(d => d._category === colCat && d.collectionOnly);
      const drinks = [...reviewed, ...collectionOnly];
      setColSuggestions({
        producer: [...new Set(drinks.map(d => d[producerKey]).filter(Boolean))].sort(),
        country: [...new Set(drinks.map(d => d.country).filter(Boolean))].sort(),
      });
    }).catch(() => {});
  }, [colCat, isEditing]);

  const getTagInput = key => tagInputs[key] || '';
  const setTagInputFor = (key, value) => setTagInputs(prev => ({ ...prev, [key]: value }));

  const addTag = (setter, key, tag) => {
    setter(prev => {
      if (!tag || (prev[key] || []).includes(tag)) return prev;
      return { ...prev, [key]: [...(prev[key] || []), tag] };
    });
  };

  const removeTag = (setter, key, tag) => {
    setter(prev => ({ ...prev, [key]: prev[key].filter(t => t !== tag) }));
  };

  const varietySuggestions = [...new Set(categoryDrinks.flatMap(d => d.variety || []))].sort();
  const tagSuggestionsFor = (key) => key === 'variety' ? varietySuggestions : allTags;

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setForm(emptyForm(cat));
    setMessage('');
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e, { another = false } = {}) => {
    e.preventDefault();
    if (!isEditing) {
      const missing = [PRODUCER_FIELD[category], NAME_FIELD[category], 'country']
        .filter(key => !String(form[key] ?? '').trim())
        .map(key => FIELDS[category].find(f => f.key === key)?.label ?? key);
      if (missing.length && !window.confirm(`Missing ${missing.join(', ')}. Add anyway?`)) return;
    }
    if (duplicate && !window.confirm(
      `This looks like a duplicate of an existing entry: "${duplicate[PRODUCER_FIELD[category]]} — ${duplicate[NAME_FIELD[category]]}". Save anyway?`
    )) return;
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
      if (another) {
        setForm(emptyForm(category));
        setMessage('Added! Add another below.');
        return;
      }
      const newDrink = await res.json();
      navigate('/admin', { state: { drink: newDrink, category, tab: 'tastings' } });
      return;
    }
    setMessage('Entry updated!');
  };

  const handleAddLot = async () => {
    const qty = parsePositiveInt(newLotQty);
    if (qty === null) { setCollectionMessage('Quantity must be a positive whole number.'); return; }
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

  const handleAddToCollection = async (another = false) => {
    const missing = [['producer', 'Producer'], ['name', 'Name'], ['country', 'Country']]
      .filter(([key]) => !colForm[key].trim())
      .map(([, label]) => label);
    if (missing.length && !window.confirm(`Missing ${missing.join(', ')}. Add anyway?`)) return;
    const qty = parsePositiveInt(colForm.qty);
    if (qty === null) { setColMessage('Quantity must be a positive whole number.'); return; }
    const producerKey = PRODUCER_FIELD[colCat];
    const nameKey = colCat === 'wine' ? 'seriesAndName' : 'name';
    const drinkRes = await fetch(`/api/${colCat}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [producerKey]: colForm.producer, [nameKey]: colForm.name, country: colForm.country, abv: colForm.abv, collectionOnly: true, tags: colForm.tags }),
    });
    if (!drinkRes.ok) { setColMessage('Failed to add drink.'); return; }
    const drink = await drinkRes.json();
    const lotBody = { quantity: qty };
    if (colForm.price !== '') lotBody.price = parseFloat(colForm.price);
    await fetch(`/api/${colCat}/${drink.id}/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lotBody),
    });
    const imageFile = newColImageRef.current;
    newColImageRef.current = null;
    setNewColImage(null);
    if (imageFile) {
      const fd = new FormData();
      fd.append('image', imageFile);
      await fetch(`/api/${colCat}/${drink.id}/collection/image`, { method: 'POST', body: fd }).catch(() => {});
    }
    if (another) {
      setColForm({ producer: '', name: '', country: '', abv: '', qty: '1', price: '', tags: [] });
      setColMessage('Added! Add another below.');
      return;
    }
    navigate('/collection');
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

    if (drankIt && editState.lot) {
      await fetch(`/api/${category}/${form.id}/collection/${editState.lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: editState.lot.quantity - 1 }),
      });
      navigate('/collection');
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

  const handleCollectionImage = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`/api/${category}/${form.id}/collection/image`, { method: 'POST', body: fd });
    if (!res.ok) { setCollectionMessage('Failed to upload photo.'); return; }
    const updated = await res.json();
    setForm(prev => ({ ...prev, collectionImageUrl: updated.collectionImageUrl }));
    setCollectionMessage('Photo updated!');
  };

  const handleUpdateTags = async (tags) => {
    const res = await fetch(`/api/${category}/${form.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) { setCollectionMessage('Failed to update collection tags.'); return; }
    setForm(prev => ({ ...prev, tags }));
    setCollectionMessage('Collection tags updated!');
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

  const producerVal = form[PRODUCER_FIELD[category]];
  const nameVal = form[NAME_FIELD[category]];
  const editTitle = (producerVal || nameVal) ? `${producerVal || ''} — ${nameVal || ''}` : 'Edit Entry';

  return (
    <div className="admin-page">
      <h1>{isEditing ? editTitle : 'Add Entry'}</h1>

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
      <form onSubmit={handleSubmit} className="admin-form" autoComplete="off">
        {FIELDS[category].map(field => (
          <div key={field.key} className="form-group">
            <label htmlFor={field.key}>{field.label}</label>
            {field.type === 'tags' ? (
              <div className="tags-input">
                <div className="tags-chips">
                  {(form[field.key] || []).map(tag => (
                    <span key={tag} className="tag-chip">
                      {tag}
                      <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(setForm, field.key, tag)}>×</button>
                    </span>
                  ))}
                </div>
                <AutocompleteInput
                  name="tagInput"
                  ref={getInputRef(field.key)}
                  value={getTagInput(field.key)}
                  onChange={e => setTagInputFor(field.key, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(setForm, field.key, getTagInput(field.key).trim());
                      setTagInputFor(field.key, '');
                      getInputRef(field.key).current?.focus();
                    }
                  }}
                  suggestions={tagSuggestionsFor(field.key)}
                  placeholder="Type a tag and press Enter"
                  enterKeyHint="enter"
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

        {duplicate && (
          <p className="success-message" data-testid="duplicate-warning">
            Possible duplicate: "{duplicate[PRODUCER_FIELD[category]]} — {duplicate[NAME_FIELD[category]]}" already exists.
          </p>
        )}

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
          {!isEditing && (
            <button type="button" className="btn-primary" onClick={(e) => handleSubmit(e, { another: true })}>
              Add Another
            </button>
          )}
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
            { key: 'producer', label: 'Producer', type: 'text', autocomplete: true },
            { key: 'name',     label: 'Name',     type: 'text' },
            { key: 'country',  label: 'Country',  type: 'text', autocomplete: true },
            { key: 'abv',      label: 'ABV (%)',  type: 'number' },
            { key: 'qty',      label: 'Quantity', type: 'number' },
            { key: 'price',    label: 'Price',    type: 'number', placeholder: 'Optional' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label htmlFor={`col-${f.key}`}>{f.label}</label>
              {f.autocomplete ? (
                <AutocompleteInput
                  id={`col-${f.key}`}
                  name={f.key}
                  value={colForm[f.key]}
                  onChange={e => setColForm(p => ({ ...p, [f.key]: e.target.value }))}
                  suggestions={colSuggestions[f.key] || []}
                />
              ) : (
                <input
                  id={`col-${f.key}`}
                  type={f.type}
                  min={f.type === 'number' ? (f.key === 'qty' ? 1 : 0) : undefined}
                  step={f.type === 'number' ? (f.key === 'qty' ? '1' : '0.1') : undefined}
                  placeholder={f.placeholder || ''}
                  value={colForm[f.key]}
                  onChange={e => setColForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="form-group">
            <label htmlFor="col-tags">Tags</label>
            <div className="tags-input">
              <div className="tags-chips">
                {colForm.tags.map(tag => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(setColForm, 'tags', tag)}>×</button>
                  </span>
                ))}
              </div>
              <AutocompleteInput
                id="col-tags"
                name="colTagInput"
                ref={getInputRef('tags')}
                value={getTagInput('tags')}
                onChange={e => setTagInputFor('tags', e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(setColForm, 'tags', getTagInput('tags').trim());
                    setTagInputFor('tags', '');
                    getInputRef('tags').current?.focus();
                  }
                }}
                suggestions={allTags}
                placeholder="Type a tag and press Enter"
                enterKeyHint="enter"
              />
            </div>
          </div>
          <div className="form-actions">
            <PhotoInputButtons
              variant="btn-photo-add"
              hasPhoto={!!newColImage}
              label="Add photo"
              testId="new-col-img"
              onSelect={f => { newColImageRef.current = f; setNewColImage(f); }}
              openUp
            />
            <button type="button" className="btn-primary" onClick={() => handleAddToCollection()}>Add to Collection</button>
            <button type="button" className="btn-primary" onClick={() => handleAddToCollection(true)}>Add Another</button>
          </div>
          {colMessage && <p className="success-message">{colMessage}</p>}
        </div>
      )}

      {isEditing && activeTab === 'collection' && (
        <section className="collection-section tastings-section">
          <div className="tastings-main">
          <h2>My Collection</h2>
          <div className="lot-row collection-photo-row">
            {form.collectionImageUrl
              ? <img src={form.collectionImageUrl} alt="" className="tasting-thumb" data-testid="collection-img" />
              : <div className="tasting-thumb-placeholder" data-testid="collection-placeholder" />}
            <PhotoInputButtons
              variant="btn-upload-img"
              hasPhoto={!!form.collectionImageUrl}
              label="Add photo"
              testId="collection-img-upload"
              onSelect={f => handleCollectionImage(f)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="tags">Tags</label>
            <div className="tags-input">
              <div className="tags-chips">
                {(form.tags || []).map(tag => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button type="button" aria-label={`Remove ${tag}`} onClick={() => handleUpdateTags(form.tags.filter(t => t !== tag))}>×</button>
                  </span>
                ))}
              </div>
              <AutocompleteInput
                name="tagInput"
                ref={getInputRef('tags')}
                value={getTagInput('tags')}
                onChange={e => setTagInputFor('tags', e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const tag = getTagInput('tags').trim();
                    if (tag && !(form.tags || []).includes(tag)) {
                      handleUpdateTags([...(form.tags || []), tag]);
                    }
                    setTagInputFor('tags', '');
                    getInputRef('tags').current?.focus();
                  }
                }}
                suggestions={allTags}
                placeholder="Type a tag and press Enter"
                enterKeyHint="enter"
              />
            </div>
          </div>
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
              <input id="new-lot-qty" type="number" min="1" step="1" value={newLotQty} onChange={e => setNewLotQty(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="new-lot-price">Price</label>
              <input id="new-lot-price" type="number" min="0" step="0.01" placeholder="Optional" value={newLotPrice} onChange={e => setNewLotPrice(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleAddLot}>Add Lot</button>
          </div>
          {collectionMessage && <p className="success-message">{collectionMessage}</p>}
          </div>
          {form.collectionImageUrl && (
            <div className="tastings-preview">
              <img src={form.collectionImageUrl} alt="" data-testid="collection-preview-img" />
            </div>
          )}
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
                      <PhotoInputButtons
                        variant="btn-upload-img"
                        hasPhoto={!!t.imageUrl}
                        label="Add photo"
                        testId={`img-upload-${t.id}`}
                        onSelect={f => handleTastingImage(t.id, f)}
                      />
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
                popperModifiers={[shift({ padding: 8 })]}
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
            <PhotoInputButtons
              variant="btn-photo-add"
              hasPhoto={!!newTastingImage}
              label="Add photo"
              testId="new-tasting-img"
              onSelect={f => { newTastingImageRef.current = f; setNewTastingImage(f); }}
            />
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
