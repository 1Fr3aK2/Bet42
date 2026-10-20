import { formatTime } from '../utils/format';
import { WINDOW, MINUTE } from '../data/constants';

export default function Timer({ cycleSecond, hasQueuedBet }) {
  const inWindow = cycleSecond < WINDOW;

  const progress = inWindow
    ? (cycleSecond / WINDOW) * 100
    : ((MINUTE - cycleSecond) / (MINUTE - WINDOW)) * 100;

  const countdown = inWindow ? WINDOW - cycleSecond : MINUTE - cycleSecond;

  const label = inWindow
    ? 'Betting window open'
    : hasQueuedBet
      ? 'Bet queued for next round'
      : 'Betting on next round';

  return (
    <div className="timer-section">
      <div className="timer-top">
        <span className="timer-label">{label}</span>
        <span className="timer-countdown">{formatTime(countdown)}</span>
      </div>
      <div className="timer-bar-wrapper">
        <div
          className="timer-bar"
          style={{ width: `${progress}%`, background: inWindow ? '#e8a020' : '#2e3347' }}
        />
      </div>
    </div>
  );
}
