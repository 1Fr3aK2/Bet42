import { formatDuration } from '../utils/format';

const QUICK_AMOUNTS = [50, 100, 250, 500];

export default function BetSection({
  rules,
  balance,
  isLoggedIn,
  betAmount,
  onAmountChange,
  duration,
  onDurationChange,
  onBet,
  placing,
  betStatus,
  error,
  priceReady,
}) {
  const payout = rules?.payoutMultiplier ?? 1.85;
  const win = Math.floor((parseFloat(betAmount) || 0) * payout);
  const disabled = placing || !priceReady;

  return (
    <div className="bet-section">
      <div className="bet-input-row">
        <span className="bet-label" id="duration-label">Expires in</span>
        <div className="quick-amounts" role="group" aria-labelledby="duration-label">
          {(rules?.durations ?? [60, 300]).map((seconds) => (
            <button
              key={seconds}
              type="button"
              aria-pressed={duration === seconds}
              className={`quick-btn ${duration === seconds ? 'quick-btn--active' : ''}`}
              onClick={() => onDurationChange(seconds)}
            >
              {formatDuration(seconds)}
            </button>
          ))}
        </div>
      </div>

      <div className="bet-input-row">
        <label className="bet-label" htmlFor="bet-amount">Bet amount</label>

        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((amt) => (
            <button key={amt} type="button" className="quick-btn" onClick={() => onAmountChange(String(amt))}>
              {amt}
            </button>
          ))}
          <button
            type="button"
            className="quick-btn"
            disabled={!isLoggedIn}
            onClick={() => onAmountChange(String(Math.min(Math.floor(balance), rules?.maxBet ?? balance)))}
          >
            MAX
          </button>
        </div>

        <div className="bet-input-wrapper">
          <span className="bet-currency" aria-hidden="true">T$</span>
          <input
            id="bet-amount"
            className="bet-input"
            type="number"
            inputMode="numeric"
            min={rules?.minBet ?? 1}
            max={rules?.maxBet ?? 100000}
            step="1"
            value={betAmount}
            aria-invalid={Boolean(error)}
            aria-describedby="bet-feedback"
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </div>
      </div>

      <div className="payout-info">
        Payout: <span className="payout-multiplier">x{payout}</span>
        &nbsp;·&nbsp; Win: <span className="payout-win">T$ {win.toLocaleString('en-US')}</span>
      </div>

      <div className="bet-buttons">
        <button className="bet-btn bet-up" disabled={disabled} onClick={() => onBet('UP')}>
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          UP
        </button>
        <button className="bet-btn bet-down" disabled={disabled} onClick={() => onBet('DOWN')}>
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          DOWN
        </button>
      </div>

      <div id="bet-feedback" aria-live="polite">
        {error ? (
          <div className="bet-status active down">{error}</div>
        ) : !isLoggedIn ? (
          <div className="bet-status active">Log in or register to place bets (1,000 T$ welcome balance)</div>
        ) : !priceReady ? (
          <div className="bet-status active">Waiting for the live price…</div>
        ) : (
          <div className={`bet-status ${betStatus.type || betStatus.text ? `active ${betStatus.type}` : ''}`}>
            {betStatus.text}
          </div>
        )}
      </div>
    </div>
  );
}
