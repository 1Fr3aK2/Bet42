import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  TickMarkType,
  createChart,
} from 'lightweight-charts';
import { apiFetch } from '../api/client';
import { useSocketEvent } from '../context/AppContext';

const UP = '#2ea84b';
const DOWN = '#e05252';
const VISIBLE_BARS = 90;

const price = (p) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Groups 1-minute candles into candles of `seconds` (60, 300, 900).
function aggregate(candles, seconds) {
  if (seconds === 60) return candles.map((c) => ({ ...c }));

  const out = [];
  for (const c of candles) {
    const time = Math.floor(c.time / seconds) * seconds;
    const last = out[out.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.volume += c.volume;
    } else {
      out.push({ ...c, time });
    }
  }
  return out;
}

const volumeBar = (c) => ({
  time: c.time,
  value: c.volume,
  color: c.close >= c.open ? 'rgba(46,168,75,0.35)' : 'rgba(224,82,82,0.35)',
});

// Times are Unix seconds; show them in the viewer's local time.
function tickMark(time, type) {
  const date = new Date(time * 1000);
  if (type === TickMarkType.DayOfMonth || type === TickMarkType.Month || type === TickMarkType.Year) {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Live candlestick chart (green = price went up during the period, red = down)
// with volume bars and the entry price of each open bet.
export default function CandleChart({ coin, interval, bets = [] }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const baseRef = useRef([]); // 1-minute candles of the current coin
  const [legend, setLegend] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  // Create the chart once.
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#13151e' },
        textColor: '#9aa3b8',
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 11,
      },
      grid: { vertLines: { color: '#1a1e2a' }, horzLines: { color: '#1a1e2a' } },
      rightPriceScale: { borderColor: '#2e3347' },
      timeScale: {
        borderColor: '#2e3347',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        tickMarkFormatter: tickMark,
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        priceFormatter: price,
        timeFormatter: (time) =>
          new Date(time * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.26 } });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // Legend: the candle under the mouse, or the latest one.
    chart.subscribeCrosshairMove((param) => {
      const bar = param.time ? param.seriesData.get(candles) : null;
      setLegend(bar ?? null);
    });

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  // Draws every candle of the selected interval from the 1-minute history.
  const render = useCallback(() => {
    const bars = aggregate(baseRef.current, intervalRef.current);
    candleSeriesRef.current?.setData(bars.map(({ volume, ...bar }) => bar));
    volumeSeriesRef.current?.setData(bars.map(volumeBar));
    if (bars.length) {
      chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - VISIBLE_BARS), to: bars.length + 4 });
    }
  }, []);

  // History of the selected coin.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    apiFetch(`/crypto/${coin}/candles`, { token: '' })
      .then((candles) => {
        if (cancelled) return;
        baseRef.current = Array.isArray(candles) ? candles : [];
        setStatus(baseRef.current.length ? 'ready' : 'error');
        render();
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [coin, render]);

  // New interval: regroup the candles already loaded.
  useEffect(() => {
    render();
  }, [interval, render]);

  // Live updates of the current minute.
  useSocketEvent('crypto:candle', ({ symbol, candle }) => {
    if (symbol.split('/')[0] !== coin || !candleSeriesRef.current) return;

    const base = baseRef.current;
    const last = base[base.length - 1];
    if (last && candle.time === last.time) base[base.length - 1] = candle;
    else if (!last || candle.time > last.time) base.push(candle);
    else return;

    // Rebuild only the aggregated candle this minute belongs to.
    const start = Math.floor(candle.time / interval) * interval;
    const [bar] = aggregate(base.filter((c) => c.time >= start && c.time < start + interval), interval);
    if (!bar) return;

    const { volume, ...ohlc } = bar;
    candleSeriesRef.current.update(ohlc);
    volumeSeriesRef.current.update(volumeBar(bar));
    if (status !== 'ready') setStatus('ready');
  });

  // Dashed line at the entry price of every open bet on this coin.
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = bets
      .filter((bet) => bet.coin === coin)
      .map((bet) =>
        series.createPriceLine({
          price: bet.entryPrice,
          color: bet.direction === 'UP' ? UP : DOWN,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${bet.direction} ${bet.amount} T$`,
        })
      );
  }, [bets, coin]);

  const latest = baseRef.current.length ? aggregate(baseRef.current.slice(-15), interval).at(-1) : null;
  const shown = legend ?? latest;
  const change = shown ? ((shown.close - shown.open) / shown.open) * 100 : 0;

  return (
    <figure
      className="relative m-0"
      aria-label={`${coin}/EUR candlestick chart, ${interval / 60}-minute candles${latest ? `, last price ${price(latest.close)} euros` : ''}`}
    >
      <div className="mb-2 flex min-h-5 flex-wrap gap-x-3 font-mono text-[11px] text-dim" aria-live="off">
        {shown && (
          <>
            <span>O <span className="text-text">{price(shown.open)}</span></span>
            <span>H <span className="text-text">{price(shown.high)}</span></span>
            <span>L <span className="text-text">{price(shown.low)}</span></span>
            <span>C <span className="text-text">{price(shown.close)}</span></span>
            <span className={change >= 0 ? 'text-up' : 'text-down'}>
              {change >= 0 ? '▲ +' : '▼ '}{change.toFixed(2)}%
            </span>
          </>
        )}
      </div>
      <div ref={containerRef} className="h-[300px] w-full sm:h-[340px]" />
      {status !== 'ready' && (
        <div className="absolute inset-0 top-7 flex items-center justify-center text-xs uppercase tracking-wider text-dim">
          {status === 'loading' ? 'Loading candles…' : 'Candles unavailable right now'}
        </div>
      )}
    </figure>
  );
}
