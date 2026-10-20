import { fmt, formatVolume } from '../utils/format';

// Live price and 24h statistics from Kraken (EUR market).
export default function PriceDisplay({ coin, info }) {
  const changePct = info?.changePct;
  const isUp = (changePct ?? 0) >= 0;

  return (
    <>
      <div className="price-display" aria-live="off">
        <span className="price-coin">{coin}/EUR</span>
        <span className="price-value">{info?.price ? fmt(info.price) : 'Loading…'}</span>
        {changePct !== null && changePct !== undefined && (
          <span className={`price-change ${isUp ? 'up' : 'down'}`} title="Change over the last 24 hours">
            {isUp ? '+' : ''}{changePct.toFixed(2)}% 24h
          </span>
        )}
      </div>

      <div className="coin-stats">
        <div className="stat">
          <span className="stat-label">24H High</span>
          <span className="stat-value up">{fmt(info?.high)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">24H Low</span>
          <span className="stat-value down">{fmt(info?.low)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">24H Volume</span>
          <span className="stat-value">{formatVolume(info?.volume)} {coin}</span>
        </div>
      </div>
    </>
  );
}
