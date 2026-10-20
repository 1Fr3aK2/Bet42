import { PAYOUT } from '../data/constants';

const QUICK_AMOUNTS = [50, 100, 250, 500];

export default function BetSection({ betAmount, onAmountChange, balance, onBet, betStatus }) {
  const win = Math.floor((parseFloat(betAmount) || 0) * PAYOUT);

  return (
    <div className="bet-section">
      <div className="bet-input-row">
        <label className="bet-label">Bet amount</label>

        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((amt) => (
            <button key={amt} className="quick-btn" onClick={() => onAmountChange(amt)}>
              {amt}
            </button>
          ))}
          <button className="quick-btn" onClick={() => onAmountChange(Math.floor(balance))}>
            MAX
          </button>
        </div>

        <div className="bet-input-wrapper">
          <span className="bet-currency">T$</span>
          <input
            className="bet-input"
            type="number"
            min="1"
            value={betAmount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </div>
      </div>

      <div className="payout-info">
        Payout: <span className="payout-multiplier">x{PAYOUT}</span>
        &nbsp;·&nbsp; Win: <span className="payout-win">T$ {win.toLocaleString()}</span>
      </div>

      <div className="bet-buttons">
        <button className="bet-btn bet-up" onClick={() => onBet('up')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          UP
        </button>
        <button className="bet-btn bet-down" onClick={() => onBet('down')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          DOWN
        </button>
      </div>

      <div className={`bet-status ${betStatus.type ? `active ${betStatus.type}` : ''}`}>
        {betStatus.text}
      </div>
    </div>
  );
}
