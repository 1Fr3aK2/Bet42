// Prices come from Kraken's EUR markets.
export function fmt(price) {
  if (price === null || price === undefined || Number.isNaN(price)) return '—';
  return '€' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTime(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// T$ amounts (the demo currency)
export function formatTD(amount, { sign = false } = {}) {
  const value = Math.round(amount ?? 0);
  const prefix = sign && value > 0 ? '+' : '';
  return `${prefix}${value.toLocaleString('en-US')} T$`;
}

export function formatPercent(ratio, digits = 1) {
  return `${((ratio ?? 0) * 100).toFixed(digits)}%`;
}

export function formatDuration(seconds) {
  return seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;
}

export function formatVolume(volume) {
  if (volume === null || volume === undefined) return '—';
  return volume.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
