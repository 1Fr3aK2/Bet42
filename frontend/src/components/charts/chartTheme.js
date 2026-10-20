// Chart colours, validated against the card surface (#13151e) with the
// dataviz palette validator: every mark >= 3:1 contrast, single-series blue
// inside the dark lightness band.
//
// Win/loss use the app's status colours (green/red). Red/green cannot be told
// apart with deuteranopia, so they are never used alone: legends carry icons
// and labels, profit bars also encode the sign by position (above/below 0),
// and every chart has a table view.
export const COLORS = {
  series: '#3987e5', // single-series slot
  good: '#2ea84b', // won / profit
  critical: '#e05252', // lost / loss
  neutral: '#6b7590', // refunded
  pending: '#e8a020', // still open
  surface: '#13151e',
  grid: '#1e2330',
  axis: '#2e3347',
  tick: '#9aa3b8',
};

export const OUTCOMES = {
  WON: { label: 'Won', icon: '✓', color: COLORS.good },
  LOST: { label: 'Lost', icon: '✗', color: COLORS.critical },
  REFUNDED: { label: 'Refunded', icon: '↺', color: COLORS.neutral },
  PENDING: { label: 'Open', icon: '◷', color: COLORS.pending },
};

// Shared props: hairline solid grid, recessive axes, readable ticks.
export const gridProps = { stroke: COLORS.grid, vertical: false };

export const axisProps = {
  stroke: COLORS.axis,
  tick: { fill: COLORS.tick, fontSize: 11 },
  tickLine: false,
};

export function compact(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}K`;
  return Math.round(value).toLocaleString('en-US');
}

export function shortDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function shortDateTime(time) {
  return new Date(time).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
