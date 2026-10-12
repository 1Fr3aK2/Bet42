// Tooltip for every chart: the value leads, the series name follows,
// each row keyed with a short line of the series colour.
export default function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded border border-line-strong bg-bg px-3 py-2 font-mono text-xs shadow-lg">
      <div className="mb-1 text-dim">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {payload
        .filter((item) => item.value !== null && item.value !== undefined)
        .map((item) => (
          <div key={item.dataKey ?? item.name} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-3" style={{ background: item.color ?? item.payload?.fill }} />
            <strong className="text-text">{valueFormatter ? valueFormatter(item.value, item) : item.value}</strong>
            <span className="text-dim">{item.name}</span>
          </div>
        ))}
    </div>
  );
}
