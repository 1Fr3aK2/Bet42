import { formatDuration, formatTD } from '../utils/format';

// Last settled bets of the logged-in user.
export default function HistoryList({ history }) {
  return (
    <div className="history-panel">
      <div className="side-panel-title">Recent Results</div>
      <div className="history-list">
        {history.length === 0 && (
          <div className="history-empty">No results yet — place your first bet</div>
        )}

        {history.map((bet) => {
          const move = bet.exitPrice ? ((bet.exitPrice - bet.entryPrice) / bet.entryPrice) * 100 : 0;
          const won = bet.status === 'WON';
          const refunded = bet.status === 'REFUNDED';
          return (
            <div className="history-item" key={bet.id}>
              <div className="history-left">
                <span className="history-coin">{bet.coin}</span>
                <span className={`history-direction ${bet.direction.toLowerCase()}`}>{bet.direction}</span>
                <span className="history-move">
                  {move >= 0 ? '+' : ''}{move.toFixed(3)}% · {formatDuration(bet.duration)}
                </span>
              </div>
              <span className={`history-result ${refunded ? '' : won ? 'win' : 'loss'}`}>
                {refunded ? 'Refund' : formatTD(bet.profit, { sign: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
