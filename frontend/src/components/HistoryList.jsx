import { PAYOUT } from '../data/constants';

export default function HistoryList({ history }) {
  return (
    <div className="history-panel">
      <div className="side-panel-title">Recent Results</div>
      <div className="history-list">
        {history.length === 0 && (
          <div className="history-empty">No bets yet — place your first bet</div>
        )}

        {history.map((h) => {
          const sign = h.diff >= 0 ? '+' : '';
          const payout = h.won ? `+T$ ${Math.floor(h.amount * PAYOUT)}` : `-T$ ${h.amount}`;
          return (
            <div className="history-item" key={h.id}>
              <div className="history-left">
                <span className="history-coin">{h.coin}</span>
                <span className={`history-direction ${h.direction}`}>{h.direction.toUpperCase()}</span>
                <span className="history-move">{sign}{h.diff.toFixed(3)}%</span>
              </div>
              <span className={`history-result ${h.won ? 'win' : 'loss'}`}>{payout}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
