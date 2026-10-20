import { useApp } from '../context/AppContext';

const STATES = {
  live: { label: 'Live', dot: 'bg-up' },
  connecting: { label: 'Connecting…', dot: 'bg-accent' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-accent animate-pulse' },
  offline: { label: 'Offline', dot: 'bg-down' },
};

// Real-time connection state + how many players are online right now.
export default function ConnectionBadge() {
  const { connection, presence } = useApp();
  const state = STATES[connection] ?? STATES.connecting;

  return (
    <div
      role="status"
      aria-live="polite"
      className="hidden items-center gap-2 rounded border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-dim sm:flex"
      title={`${presence.connections} open connection(s)`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state.dot}`} />
      <span>{state.label}</span>
      {connection === 'live' && (
        <span className="text-faint">· {presence.traders} online</span>
      )}
    </div>
  );
}
