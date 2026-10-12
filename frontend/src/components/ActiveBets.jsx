import { fmt, formatDuration, formatTime, formatTD } from '../utils/format';
import { useNow } from '../hooks/useNow';

// Open bets with their countdown and whether they are winning right now.
export default function ActiveBets({ bets, prices }) {
  const now = useNow(1000);

  if (bets.length === 0) {
    return (
      <div className="active-bet-card">
        <div className="side-panel-title">Open bets</div>
        <div className="history-empty">No open bets</div>
      </div>
    );
  }

  return (
    <div className="active-bets-list">
      {bets.map((bet) => {
        const remaining = Math.max(0, Math.ceil((new Date(bet.expiresAt).getTime() - now) / 1000));
        const progress = 1 - remaining / bet.duration;
        const price = prices[bet.coin]?.price;
        // 'winning' / 'losing' / 'even' (same price = refund) compared with the entry price
        let trend = null;
        if (price !== undefined && price !== null) {
          if (price === bet.entryPrice) trend = 'even';
          else trend = (bet.direction === 'UP') === (price > bet.entryPrice) ? 'winning' : 'losing';
        }

        return (
          <div className="active-bet-card" key={bet.id}>
            <div className="mb-3 flex items-center justify-between">
              <div className="side-panel-title !mb-0">Open bet · {formatDuration(bet.duration)}</div>
              <span className={`text-xs font-bold ${remaining ? 'text-accent' : 'text-dim'}`} aria-label={`${remaining} seconds left`}>
                {remaining ? formatTime(remaining) : 'Settling…'}
              </span>
            </div>
            <div className="mb-3 h-1 w-full overflow-hidden rounded bg-line" aria-hidden="true">
              <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
            </div>

            <div className="active-bet-row">
              <span className="active-bet-label">Prediction</span>
              <span className={`active-bet-value ${bet.direction.toLowerCase()}`}>{bet.coin} {bet.direction}</span>
            </div>
            <div className="active-bet-row">
              <span className="active-bet-label">Entry price</span>
              <span className="active-bet-value">{fmt(bet.entryPrice)}</span>
            </div>
            <div className="active-bet-row">
              <span className="active-bet-label">Now</span>
              <span className={`active-bet-value ${trend === 'winning' ? 'up' : trend === 'losing' ? 'down' : ''}`}>
                {fmt(price)} {trend ? `· ${trend}` : ''}
              </span>
            </div>
            <div className="active-bet-row">
              <span className="active-bet-label">Stake / Potential win</span>
              <span className="active-bet-value">
                {formatTD(bet.amount)} / <span className="up">{formatTD(bet.potentialPayout)}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
