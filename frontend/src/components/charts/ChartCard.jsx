import { useState } from 'react';

// Card around a chart with its legend and a "Table" view of the same data,
// so no value is only reachable by hovering or by colour.
//   legend: [{ label, color, icon?, shape: 'line' | 'rect' }]
//   table:  { columns: [{ key, label, align? }], rows: [{...}] }
export default function ChartCard({ title, subtitle, legend, table, children, className = '' }) {
  const [view, setView] = useState('chart');

  return (
    <section className={`rounded-lg border border-line bg-panel p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[11px] uppercase tracking-[0.2em] text-dim">{title}</h2>
          {subtitle && <p className="m-0 mt-1 text-xs text-faint">{subtitle}</p>}
        </div>
        {table && (
          <div role="group" aria-label={`${title} view`} className="flex rounded border border-line-strong p-0.5">
            {['chart', 'table'].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`cursor-pointer rounded border-0 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  view === option ? 'bg-line-strong text-text' : 'bg-transparent text-dim hover:text-text'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {legend?.length > 0 && view === 'chart' && (
        <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-dim">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={item.shape === 'line' ? 'inline-block h-0.5 w-3.5' : 'inline-block h-2.5 w-2.5 rounded-sm'}
                style={{ background: item.color }}
              />
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {view === 'chart' || !table ? (
        children
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-panel">
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-dim">
                {table.columns.map((col) => (
                  <th key={col.key} scope="col" className={`py-1.5 pr-3 font-normal ${col.align === 'right' ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {table.columns.map((col) => (
                    <td key={col.key} className={`py-1.5 pr-3 tabular-nums text-text ${col.align === 'right' ? 'text-right' : ''}`}>
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
