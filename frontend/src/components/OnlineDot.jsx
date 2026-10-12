// Online / offline indicator: a dot plus a text label (not colour alone).
export default function OnlineDot({ online, showLabel = true }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-dim">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? 'bg-up' : 'bg-line-strong'}`} />
      {showLabel ? <span>{online ? 'Online' : 'Offline'}</span> : <span className="sr-only">{online ? 'Online' : 'Offline'}</span>}
    </span>
  );
}
