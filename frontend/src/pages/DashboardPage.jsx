import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadExport, getMyAnalytics, getPlatformAnalytics } from '../api/analytics';
import { useApp, useSocketEvent } from '../context/AppContext';
import { Button, Card, ErrorMessage, Loading, PageHeader, SegmentedControl, StatTile } from '../components/ui';
import ChartCard from '../components/charts/ChartCard';
import ChartTooltip from '../components/charts/ChartTooltip';
import { COLORS, OUTCOMES, axisProps, compact, gridProps, shortDate, shortDateTime } from '../components/charts/chartTheme';
import { formatPercent, formatTD } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

const PRESETS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'custom', label: 'Custom' },
];

const isoDay = (date) => date.toISOString().slice(0, 10);

// Axis labels for time series: hours for a short span, dates otherwise.
function timeTickFormatter(points) {
  const span = points.length ? points[points.length - 1].time - points[0].time : 0;
  return span < 2 * DAY_MS
    ? (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : (t) => shortDate(new Date(t).toISOString().slice(0, 10));
}

// Filters -> API query, or an error message for an invalid custom range.
function buildQuery(filters) {
  let from;
  let to;

  if (filters.preset === 'custom') {
    if (!filters.from || !filters.to) return { error: 'Choose a start and an end date' };
    if (filters.from > filters.to) return { error: 'The start date must be before the end date' };
    const days = (new Date(filters.to) - new Date(filters.from)) / DAY_MS + 1;
    if (days > MAX_RANGE_DAYS) return { error: `The range cannot exceed ${MAX_RANGE_DAYS} days` };
    from = filters.from;
    to = filters.to;
  } else {
    const today = new Date();
    to = isoDay(today);
    from = isoDay(new Date(today.getTime() - (Number(filters.preset) - 1) * DAY_MS));
  }

  return {
    query: {
      from,
      to,
      coin: filters.coin || undefined,
      duration: filters.duration || undefined,
      direction: filters.direction || undefined,
    },
  };
}

const selectClass =
  'rounded border border-line-strong bg-bg px-2 py-1.5 font-mono text-xs text-text focus:border-accent';

function FilterBar({ filters, onChange, error }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3" role="search" aria-label="Dashboard filters">
      <SegmentedControl
        label="Date range"
        options={PRESETS}
        value={filters.preset}
        onChange={(preset) => onChange({ ...filters, preset })}
      />
      {filters.preset === 'custom' && (
        <>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-dim">
            From
            <input type="date" className={selectClass} value={filters.from} max={filters.to || undefined} onChange={set('from')} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-dim">
            To
            <input type="date" className={selectClass} value={filters.to} min={filters.from || undefined} onChange={set('to')} />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-dim">
        Coin
        <select className={selectClass} value={filters.coin} onChange={set('coin')}>
          <option value="">All coins</option>
          <option value="BTC">BTC</option>
          <option value="ETH">ETH</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-dim">
        Duration
        <select className={selectClass} value={filters.duration} onChange={set('duration')}>
          <option value="">All durations</option>
          <option value="60">1 min</option>
          <option value="300">5 min</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-dim">
        Direction
        <select className={selectClass} value={filters.direction} onChange={set('direction')}>
          <option value="">Up & down</option>
          <option value="UP">Up</option>
          <option value="DOWN">Down</option>
        </select>
      </label>
      {error && <p role="alert" className="m-0 w-full text-xs text-down">{error}</p>}
    </div>
  );
}

// Loads analytics for the query and reloads when bets change (live updates).
function useAnalytics(fetcher, query, liveEvents) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = useCallback(() => {
    if (!query) return;
    setLoading(true);
    fetcher(query)
      .then((result) => {
        setData(result);
        setError('');
        setUpdatedAt(new Date());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetcher, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const scheduleReload = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 800);
  }, [load]);

  useSocketEvent(liveEvents[0], scheduleReload);
  useSocketEvent(liveEvents[1], scheduleReload);

  return { data, loading, error, updatedAt };
}

function HeroFigure({ label, value, tone, hint }) {
  return (
    <div className="col-span-2 rounded-lg border border-line bg-panel p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-dim">{label}</div>
      <div className={`mt-2 text-5xl font-bold ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-text'}`}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-faint">{hint}</div>}
    </div>
  );
}

function OutcomeDonut({ outcomes }) {
  const total = outcomes.reduce((sum, o) => sum + o.count, 0);
  const data = outcomes.filter((o) => o.count > 0);

  if (!total) return <p className="py-10 text-center text-sm text-faint">No bets in this period.</p>;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 180, height: 180 }}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={data.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke={COLORS.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((o) => (
                <Cell key={o.status} fill={OUTCOMES[o.status].color} name={OUTCOMES[o.status].label} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} bet${v === 1 ? '' : 's'}`} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Direct labels: icon + name + count + share, so colour is never needed. */}
      <ul className="m-0 flex w-full list-none flex-col gap-2 p-0 text-sm">
        {outcomes.map((o) => (
          <li key={o.status} className="flex items-center justify-between gap-3 border-b border-line pb-1 last:border-0">
            <span className="flex items-center gap-2 text-dim">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: OUTCOMES[o.status].color }} />
              <span aria-hidden="true">{OUTCOMES[o.status].icon}</span>
              {OUTCOMES[o.status].label}
            </span>
            <span className="text-text">
              <strong>{o.count}</strong> <span className="text-dim">({formatPercent(o.count / total, 0)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BREAKDOWNS = [
  { value: 'byCoin', label: 'Coin' },
  { value: 'byDirection', label: 'Direction' },
  { value: 'byDuration', label: 'Duration' },
];

function BreakdownTable({ data }) {
  const [by, setBy] = useState('byCoin');
  const rows = data[by];

  return (
    <Card title="Performance breakdown" actions={<SegmentedControl label="Group by" size="sm" options={BREAKDOWNS} value={by} onChange={setBy} />}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">No bets in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Results grouped by {by.slice(2).toLowerCase()}</caption>
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-dim">
                <th scope="col" className="py-2 pr-3 font-normal">Group</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Bets</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Won / Lost</th>
                <th scope="col" className="py-2 pr-3 font-normal">Win rate</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Staked</th>
                <th scope="col" className="py-2 text-right font-normal">Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-bold text-text">{row.key}</th>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.bets}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.won} / {row.lost}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${row.winRate * 100}%` }} />
                      </div>
                      <span className="tabular-nums">{formatPercent(row.winRate)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatTD(row.wagered)}</td>
                  <td className={`py-2 text-right tabular-nums ${row.profit > 0 ? 'text-up' : row.profit < 0 ? 'text-down' : ''}`}>
                    {formatTD(row.profit, { sign: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MyAnalytics({ query, onExport, exporting }) {
  const { data, loading, error, updatedAt } = useAnalytics(getMyAnalytics, query, ['bet:settled', 'wallet:update']);

  if (error && !data) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return <Loading />;

  const s = data.summary;
  const daily = data.timeline.map((d) => ({
    ...d,
    profitPos: d.profit > 0 ? d.profit : null,
    profitNeg: d.profit < 0 ? d.profit : null,
  }));

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
        <span aria-live="polite">
          Live · updated {updatedAt?.toLocaleTimeString('en-GB')} · all times in UTC
        </span>
        <div className="flex gap-2">
          {['csv', 'json', 'pdf'].map((format) => (
            <Button key={format} size="sm" variant="secondary" disabled={exporting} onClick={() => onExport(format)}>
              Export {format}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <HeroFigure
          label="Net profit"
          value={formatTD(s.profit, { sign: true })}
          tone={s.profit > 0 ? 'up' : s.profit < 0 ? 'down' : null}
          hint={`Return on stake ${formatPercent(s.roi)} · balance now ${formatTD(data.currentBalance)}`}
        />
        <StatTile label="Win rate" value={formatPercent(s.winRate)} hint={`${s.won} won · ${s.lost} lost`} />
        <StatTile label="Bets placed" value={compact(s.bets)} hint={`${s.pending} open · ${s.refunded} refunded`} />
        <StatTile label="Total staked" value={formatTD(s.wagered)} hint={`avg ${formatTD(s.avgStake)}`} />
        <StatTile label="Best streak" value={s.bestStreak} hint={`biggest win ${formatTD(s.biggestWin)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Balance"
          subtitle="Wallet after every bet, payout and bonus (all coins)"
          table={{
            columns: [{ key: 'time', label: 'Time' }, { key: 'balance', label: 'Balance', align: 'right' }],
            rows: data.balanceHistory.map((p) => ({ time: shortDateTime(p.time), balance: formatTD(p.balance) })),
          }}
        >
          {data.balanceHistory.length < 2 ? (
            <p className="py-10 text-center text-sm text-faint">Not enough activity in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 500, height: 240 }}>
              <LineChart data={data.balanceHistory} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={timeTickFormatter(data.balanceHistory)} minTickGap={32} {...axisProps} />
                <YAxis width={56} tickFormatter={compact} {...axisProps} />
                <Tooltip
                  cursor={{ stroke: COLORS.axis }}
                  content={<ChartTooltip labelFormatter={(t) => shortDateTime(t)} valueFormatter={(v) => formatTD(v)} />}
                />
                <Line type="monotone" dataKey="balance" name="Balance" stroke={COLORS.series} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Cumulative profit"
          subtitle="Running total of settled bets (0 = break-even)"
          table={{
            columns: [{ key: 'time', label: 'Settled' }, { key: 'profit', label: 'Cumulative profit', align: 'right' }],
            rows: data.cumulativeProfit.map((p) => ({ time: shortDateTime(p.time), profit: formatTD(p.profit, { sign: true }) })),
          }}
        >
          {data.cumulativeProfit.length < 2 ? (
            <p className="py-10 text-center text-sm text-faint">Settle at least two bets to see the curve.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 500, height: 240 }}>
              <LineChart data={data.cumulativeProfit} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={timeTickFormatter(data.cumulativeProfit)} minTickGap={32} {...axisProps} />
                <YAxis width={56} tickFormatter={compact} {...axisProps} />
                <ReferenceLine y={0} stroke={COLORS.tick} strokeWidth={1} />
                <Tooltip
                  cursor={{ stroke: COLORS.axis }}
                  content={<ChartTooltip labelFormatter={(t) => shortDateTime(t)} valueFormatter={(v) => formatTD(v, { sign: true })} />}
                />
                <Line type="monotone" dataKey="profit" name="Profit" stroke={COLORS.series} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Daily profit"
          subtitle="Net result of the bets placed each day"
          legend={[
            { label: 'Profit day (above 0)', icon: '▲', color: COLORS.good },
            { label: 'Loss day (below 0)', icon: '▼', color: COLORS.critical },
          ]}
          table={{
            columns: [
              { key: 'date', label: 'Day' },
              { key: 'bets', label: 'Bets', align: 'right' },
              { key: 'wl', label: 'Won / Lost', align: 'right' },
              { key: 'profit', label: 'Profit', align: 'right' },
            ],
            rows: data.timeline.map((d) => ({ date: shortDate(d.date), bets: d.bets, wl: `${d.won} / ${d.lost}`, profit: formatTD(d.profit, { sign: true }) })),
          }}
        >
          <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 500, height: 240 }}>
            <BarChart data={daily} stackOffset="sign" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={16} {...axisProps} />
              <YAxis width={56} tickFormatter={compact} {...axisProps} />
              <ReferenceLine y={0} stroke={COLORS.tick} strokeWidth={1} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={<ChartTooltip labelFormatter={(d) => shortDate(d)} valueFormatter={(v) => formatTD(v, { sign: true })} />}
              />
              <Bar dataKey="profitPos" name="Profit" stackId="p" fill={COLORS.good} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="profitNeg" name="Loss" stackId="p" fill={COLORS.critical} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Outcomes"
          subtitle="Share of bets by result"
          table={{
            columns: [{ key: 'outcome', label: 'Outcome' }, { key: 'count', label: 'Bets', align: 'right' }],
            rows: data.outcomes.map((o) => ({ outcome: OUTCOMES[o.status].label, count: o.count })),
          }}
        >
          <OutcomeDonut outcomes={data.outcomes} />
        </ChartCard>

        <ChartCard
          title="Activity by hour (UTC)"
          subtitle="Bets placed at each hour of the day"
          className="lg:col-span-2"
          table={{
            columns: [
              { key: 'hour', label: 'Hour' },
              { key: 'bets', label: 'Bets', align: 'right' },
              { key: 'winRate', label: 'Win rate', align: 'right' },
            ],
            rows: data.byHour.map((h) => ({ hour: `${String(h.hour).padStart(2, '0')}:00`, bets: h.bets, winRate: formatPercent(h.winRate) })),
          }}
        >
          <ResponsiveContainer width="100%" height={200} initialDimension={{ width: 900, height: 200 }}>
            <BarChart data={data.byHour} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}h`} interval={1} {...axisProps} />
              <YAxis width={40} allowDecimals={false} {...axisProps} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={<ChartTooltip labelFormatter={(h) => `${String(h).padStart(2, '0')}:00 – ${String(h).padStart(2, '0')}:59 UTC`} valueFormatter={(v) => `${v} bet${v === 1 ? '' : 's'}`} />}
              />
              <Bar dataKey="bets" name="Bets" fill={COLORS.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <BreakdownTable data={data} />
    </div>
  );
}

function PlatformAnalytics({ query }) {
  const { data, loading, error, updatedAt } = useAnalytics(getPlatformAnalytics, query, ['feed:settled', 'feed:bet']);

  if (error && !data) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return <Loading />;

  const s = data.summary;

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <p className="m-0 text-xs text-faint" aria-live="polite">
        Live · updated {updatedAt?.toLocaleTimeString('en-GB')} · all players · all times in UTC
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <HeroFigure
          label="House result"
          value={formatTD(s.houseProfit, { sign: true })}
          tone={s.houseProfit > 0 ? 'up' : s.houseProfit < 0 ? 'down' : null}
          hint={`Players won ${formatPercent(s.winRate)} of decided bets`}
        />
        <StatTile label="Players" value={compact(s.totalUsers)} hint={`${s.newUsers} new in period`} />
        <StatTile label="Active traders" value={compact(s.activeTraders)} />
        <StatTile label="Bets placed" value={compact(s.bets)} hint={`${s.pending} open`} />
        <StatTile label="Volume staked" value={formatTD(s.wagered)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Daily volume"
          subtitle="T$ staked per day"
          table={{
            columns: [
              { key: 'date', label: 'Day' },
              { key: 'bets', label: 'Bets', align: 'right' },
              { key: 'volume', label: 'Volume', align: 'right' },
              { key: 'traders', label: 'Traders', align: 'right' },
              { key: 'newUsers', label: 'New players', align: 'right' },
            ],
            rows: data.timeline.map((d) => ({ date: shortDate(d.date), bets: d.bets, volume: formatTD(d.wagered), traders: d.activeTraders, newUsers: d.newUsers })),
          }}
        >
          <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 500, height: 240 }}>
            <BarChart data={data.timeline} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={16} {...axisProps} />
              <YAxis width={56} tickFormatter={compact} {...axisProps} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip labelFormatter={(d) => shortDate(d)} valueFormatter={(v) => formatTD(v)} />} />
              <Bar dataKey="wagered" name="Volume" fill={COLORS.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active traders" subtitle="Players who placed at least one bet that day">
          <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 500, height: 240 }}>
            <LineChart data={data.timeline} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={16} {...axisProps} />
              <YAxis width={40} allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ stroke: COLORS.axis }} content={<ChartTooltip labelFormatter={(d) => shortDate(d)} valueFormatter={(v) => `${v} trader${v === 1 ? '' : 's'}`} />} />
              <Line type="monotone" dataKey="activeTraders" name="Traders" stroke={COLORS.series} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Outcomes"
          subtitle="All players"
          table={{
            columns: [{ key: 'outcome', label: 'Outcome' }, { key: 'count', label: 'Bets', align: 'right' }],
            rows: data.outcomes.map((o) => ({ outcome: OUTCOMES[o.status].label, count: o.count })),
          }}
        >
          <OutcomeDonut outcomes={data.outcomes} />
        </ChartCard>

        <Card title="Top traders (profit in period)">
          {data.topTraders.length === 0 ? (
            <p className="py-6 text-center text-sm text-faint">No bets in this period.</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Top traders by profit</caption>
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-dim">
                  <th scope="col" className="py-2 pr-3 font-normal">Player</th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">Bets</th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">Win rate</th>
                  <th scope="col" className="py-2 text-right font-normal">Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.topTraders.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-bold text-text">{t.username}</th>
                    <td className="py-2 pr-3 text-right tabular-nums">{t.bets}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(t.winRate)}</td>
                    <td className={`py-2 text-right tabular-nums ${t.profit > 0 ? 'text-up' : t.profit < 0 ? 'text-down' : ''}`}>{formatTD(t.profit, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

// Analytics dashboard: interactive charts, live updates, date/coin/duration/
// direction filters and CSV / JSON / PDF export. Admins also get the
// whole-platform view.
export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { isAdmin, notify } = useApp();
  const [tab, setTab] = useState('me');
  const [filters, setFilters] = useState({ preset: '30', from: '', to: '', coin: '', duration: '', direction: '' });
  const [exporting, setExporting] = useState(false);

  const { query, error } = useMemo(() => buildQuery(filters), [filters]);

  async function handleExport(format) {
    if (!query) return;
    setExporting(true);
    try {
      await downloadExport(query, format);
    } catch (err) {
      notify(err.message, 'loss');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Dashboard"
        subtitle={tab === 'me' ? 'Your trading statistics' : 'Platform statistics (administrators only)'}
        actions={
          isAdmin && (
            <SegmentedControl
              label="Dashboard view"
              options={[
                { value: 'me', label: 'My trading' },
                { value: 'platform', label: 'Platform' },
              ]}
              value={tab}
              onChange={setTab}
            />
          )
        }
      />

      <FilterBar filters={filters} onChange={setFilters} error={error} />

      {tab === 'me' || !isAdmin ? (
        <MyAnalytics query={query} onExport={handleExport} exporting={exporting} />
      ) : (
        <PlatformAnalytics query={query} />
      )}
    </div>
  );
}
