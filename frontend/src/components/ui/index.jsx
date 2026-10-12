// Small reusable UI kit (Tailwind) used by the pages.
import { useEffect, useId, useRef } from 'react';

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-bg border-accent hover:bg-accent-strong',
  secondary: 'bg-transparent text-text border-line-strong hover:border-accent hover:text-accent',
  danger: 'bg-transparent text-down border-down/60 hover:bg-down hover:text-bg',
  ghost: 'bg-transparent text-dim border-transparent hover:text-accent',
};

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded border font-mono font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ title, actions, className = '', children, ...props }) {
  return (
    <section className={`rounded-lg border border-line bg-panel p-5 ${className}`} {...props}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[11px] uppercase tracking-[0.2em] text-dim">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const TONES = {
  neutral: 'text-text',
  accent: 'text-accent',
  up: 'text-up',
  down: 'text-down',
};

export function StatTile({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-dim">{label}</div>
      <div className={`mt-2 text-xl font-bold ${TONES[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, label, className = '' }) {
  const percent = Math.round(Math.min(1, Math.max(0, value ?? 0)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-2 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'border-line-strong text-dim',
  accent: 'border-accent/60 text-accent',
  up: 'border-up/60 text-up',
  down: 'border-down/60 text-down',
};

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Avatar({ src, name, size = 32 }) {
  return (
    <img
      src={src}
      alt={name ? `${name}'s avatar` : ''}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-line-strong bg-panel-2 object-cover"
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

export function EmptyState({ children }) {
  return <p className="py-8 text-center text-sm text-faint">{children}</p>;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <p role="status" aria-live="polite" className="py-8 text-center text-sm text-dim">
      {label}
    </p>
  );
}

export function ErrorMessage({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
      {children}
    </p>
  );
}

// Group of toggle buttons (one active option).
export function SegmentedControl({ label, options, value, onChange, size = 'md' }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded border border-line-strong bg-bg p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded border-0 font-mono font-bold uppercase tracking-wider transition-colors ${
              size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
            } ${active ? 'bg-accent text-bg' : 'bg-transparent text-dim hover:text-accent'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Labelled form field with its validation message.
export function Field({ label, error, hint, children }) {
  const id = useId();
  const messageId = `${id}-message`;
  const child = typeof children === 'function'
    ? children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? messageId : undefined })
    : children;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs uppercase tracking-wider text-dim">
        {label}
      </label>
      {child}
      {(error || hint) && (
        <span id={messageId} className={`text-xs ${error ? 'text-down' : 'text-faint'}`}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

export const inputClass =
  'w-full rounded border border-line-strong bg-bg px-3 py-2 font-mono text-sm text-text placeholder:text-faint focus:border-accent aria-[invalid=true]:border-down';

// Accessible dialog: Escape closes it, focus moves inside, background is inert.
export function Modal({ title, onClose, children, wide = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Runs once when the dialog opens (focus must not jump on re-renders).
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = dialogRef.current?.querySelector('input, select, textarea, button:not([data-close])');
    (focusable || dialogRef.current)?.focus();

    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-lg border border-line bg-panel-2 p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <h2 id={titleId} className="mb-4 pr-8 text-lg font-bold uppercase tracking-widest text-text">
          {title}
        </h2>
        <button
          type="button"
          data-close
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 cursor-pointer border-0 bg-transparent px-2 text-2xl leading-none text-dim hover:text-text"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
