import { fmt } from '../utils/format';

export default function PriceDisplay({ coin, price, basePrice, stats }) {
  const changePct = ((price - basePrice) / basePrice) * 100;
  const sign = changePct >= 0 ? '+' : '';
  const isUp = changePct >= 0;

  return (
    <>
      <div className="price-display">
        <span className="price-coin">{coin}</span>
        <span className="price-value">{fmt(price)}</span>
        <span className={`price-change ${isUp ? 'up' : 'down'}`}>
          {sign}{changePct.toFixed(2)}%
        </span>
      </div>

      <div className="coin-stats">
        <div className="stat">
          <span className="stat-label">24H High</span>
          <span className="stat-value up">{fmt(stats.high)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">24H Low</span>
          <span className="stat-value down">{fmt(stats.low)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Volume</span>
          <span className="stat-value">{stats.volume}</span>
        </div>
      </div>
    </>
  );
}
