import { Link } from 'react-router-dom';
import { formatDuration, formatTD, timeAgo } from '../utils/format';
import { useNow } from '../hooks/useNow';

// Bets and results of every player, pushed in real time over Socket.IO.
export default function LiveFeed({ items }) {
  useNow(10000); // refresh the "x seconds ago" labels

  return (
    <div className="history-panel">
      <div className="side-panel-title">Live activity</div>
      {items.length === 0 ? (
        <div className="history-empty">Nobody has placed a bet yet</div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite" aria-relevant="additions">
          {items.map((item) => {
            const settled = item.kind === 'settled';
            const tone = !settled ? 'text-dim' : item.status === 'WON' ? 'text-up' : item.status === 'LOST' ? 'text-down' : 'text-dim';
            return (
              <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 border-b border-line pb-2 text-xs last:border-0">
                <span className="min-w-0 truncate text-text">
                  <Link to={`/players/${item.userId}`} className="font-bold text-accent no-underline hover:underline">
                    {item.username}
                  </Link>{' '}
                  {settled ? (
                    <>
                      {item.status === 'WON' ? 'won' : item.status === 'LOST' ? 'lost' : 'was refunded on'} {item.coin} {item.direction}
                    </>
                  ) : (
                    <>
                      bet {formatTD(item.amount)} on {item.coin} {item.direction} · {formatDuration(item.duration)}
                    </>
                  )}
                </span>
                <span className={`shrink-0 ${tone}`}>
                  {settled && item.status !== 'REFUNDED' ? formatTD(item.payout - item.amount, { sign: true }) : timeAgo(item.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
