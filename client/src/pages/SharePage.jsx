import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './SharePage.css';

export default function SharePage() {
  const { category, id } = useParams();
  const [status, setStatus] = useState('loading');
  const [drink, setDrink] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch(`/api/public/${category}/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (!cancelled) { setDrink(data); setStatus('done'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [category, id]);

  if (status === 'loading') return <div className="category-page"><p className="empty-state">Loading&hellip;</p></div>;
  if (status === 'error') return <div className="category-page"><p className="empty-state">This drink isn&apos;t shared.</p></div>;

  return (
    <div className="category-page share-page">
      {drink.photo && <img src={drink.photo} alt="" className="share-photo" />}
      <div className="page-header">
        <h1>{drink.producer} — {drink.name}</h1>
      </div>
      <p className="share-meta">
        {drink.category}
        {drink.avgRating != null && ` · ${drink.avgRating}/10 across ${drink.tastingCount} tasting${drink.tastingCount === 1 ? '' : 's'}`}
      </p>
      {drink.tastings.length > 0 && (
        <ul className="share-tastings" data-testid="share-tastings">
          {drink.tastings.map((t, i) => (
            <li key={i}>{t.date} — {t.rating}/10</li>
          ))}
        </ul>
      )}
    </div>
  );
}
