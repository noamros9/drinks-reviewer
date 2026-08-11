import { formatPrice } from '../../utils/analyticsHelpers';

export default function SpendSummary({ summary }) {
  if (!summary) return null;
  const { cellarValue, bottles, avgBottlePrice, priciest } = summary;

  return (
    <div className="spend-summary" data-testid="spend-summary">
      <div className="spend-summary-stat">
        <span className="spend-summary-label">Cellar Value</span>
        <span className="spend-summary-value">{formatPrice(cellarValue)}</span>
      </div>
      <div className="spend-summary-stat">
        <span className="spend-summary-label">Bottles in Stock</span>
        <span className="spend-summary-value">{bottles}</span>
      </div>
      <div className="spend-summary-stat">
        <span className="spend-summary-label">Avg Bottle</span>
        <span className="spend-summary-value">{formatPrice(avgBottlePrice)}</span>
      </div>
      <div className="spend-summary-stat">
        <span className="spend-summary-label">Priciest</span>
        <span className="spend-summary-value">{priciest.label} — {formatPrice(priciest.price)}</span>
      </div>
    </div>
  );
}
