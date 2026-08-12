import { formatPrice } from '../../utils/analyticsHelpers';

export default function SpendSummary({ summary, filter = 'all' }) {
  if (!summary) return null;
  const { cellarValue, bottles, unpricedBottles, avgBottlePrice, priciest } = summary;

  return (
    <div className="spend-summary" data-testid="spend-summary">
      <div className="spend-summary-stat">
        <span className="spend-summary-label">Value</span>
        <span className="spend-summary-value">{formatPrice(cellarValue)}</span>
      </div>
      <div className="spend-summary-stat">
        <span className="spend-summary-label">Bottles</span>
        <span className="spend-summary-value">{bottles}</span>
      </div>
      {filter !== 'all' && (
        <div className="spend-summary-stat">
          <span className="spend-summary-label">Avg Bottle</span>
          <span className="spend-summary-value">{formatPrice(avgBottlePrice)}</span>
        </div>
      )}
      {priciest && (
        <div className="spend-summary-stat">
          <span className="spend-summary-label">Priciest</span>
          <span className="spend-summary-value">{priciest.label} — {formatPrice(priciest.price)}</span>
        </div>
      )}
      {unpricedBottles > 0 && (
        <p className="scope-note">{unpricedBottles} bottle{unpricedBottles === 1 ? '' : 's'} unpriced.</p>
      )}
    </div>
  );
}
