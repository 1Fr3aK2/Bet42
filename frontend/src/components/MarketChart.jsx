import { useState } from 'react';
import CandleChart from './CandleChart';
import PriceChart from './PriceChart';
import { SegmentedControl } from './ui';

const STORAGE_KEY = 'chart-settings';
const INTERVALS = [
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
];
const TYPES = [
  { value: 'candles', label: 'Candles' },
  { value: 'line', label: 'Line' },
];

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

// Chart card of the trading page: candlesticks (1m / 5m / 15m) or the
// 10-minute line chart. The choice is remembered in the browser.
export default function MarketChart({ coin, history, bets }) {
  const [settings, setSettings] = useState(() => {
    const saved = readSettings();
    return {
      type: saved.type === 'line' ? 'line' : 'candles',
      interval: INTERVALS.some((i) => i.value === saved.interval) ? saved.interval : 60,
    };
  });

  function update(changes) {
    const next = { ...settings, ...changes };
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode): the choice is just not remembered
    }
  }

  const isCandles = settings.type === 'candles';

  return (
    <div className="price-chart">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="side-panel-title !mb-0">
          {coin}/EUR — {isCandles ? `${settings.interval / 60}-minute candles` : 'last 10 minutes'}
        </h2>
        <div className="flex flex-wrap gap-2">
          {isCandles && (
            <SegmentedControl
              size="sm"
              label="Candle interval"
              options={INTERVALS}
              value={settings.interval}
              onChange={(interval) => update({ interval })}
            />
          )}
          <SegmentedControl size="sm" label="Chart type" options={TYPES} value={settings.type} onChange={(type) => update({ type })} />
        </div>
      </div>

      {isCandles ? (
        <CandleChart coin={coin} interval={settings.interval} bets={bets} />
      ) : (
        <PriceChart coin={coin} data={history} bets={bets} embedded />
      )}
    </div>
  );
}
