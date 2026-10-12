import { useApp } from '../context/AppContext';

const STYLES = {
  win: 'border-up bg-[#1a3d24] text-[#5fd47a]', // text 6.4:1 on its background
  loss: 'border-down bg-[#3d1a1a] text-[#ff8080]', // text 6.4:1 on its background
  achievement: 'border-accent bg-[#3a2c10] text-accent',
  info: 'border-line-strong bg-panel-2 text-text',
};

// Stack of notifications (bet results, achievements, errors...).
// Screen readers announce them through the polite live region.
export default function Toasts() {
  const { toasts, dismissToast } = useApp();

  return (
    <div
      aria-live="polite"
      className="no-print pointer-events-none fixed bottom-4 right-4 z-[1100] flex w-[min(92vw,360px)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={`pointer-events-auto cursor-pointer rounded-md border px-4 py-3 text-left font-mono text-xs font-bold tracking-wide shadow-lg ${STYLES[toast.type] ?? STYLES.info}`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
