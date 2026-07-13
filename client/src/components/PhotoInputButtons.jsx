export default function PhotoInputButtons({ hasPhoto, label, variant, onSelect, testId }) {
  const pick = e => onSelect(e.target.files[0] || null);
  return (
    <span className="photo-input-buttons">
      <label className={`${variant}${hasPhoto ? ' has-photo' : ''}`}>
        📷 Take Photo
        <input type="file" accept="image/*" capture="environment" data-testid={testId && `${testId}-camera`} onChange={pick} />
      </label>
      <label className={variant}>
        {hasPhoto ? 'Change photo' : label}
        <input type="file" accept="image/*" data-testid={testId} onChange={pick} />
      </label>
    </span>
  );
}
