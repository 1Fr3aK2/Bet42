import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Last 10 minutes of the live price. Dashed lines = entry prices of open bets.
// `embedded`: drawn inside MarketChart, which provides the card and the title.
export default function PriceChart({ coin, data, bets = [], embedded = false }) {
  const title = `${coin}/EUR — Last 10 Minutes`;

  if (data.length < 2) {
    return embedded ? (
      <div className="history-empty">Gathering price data…</div>
    ) : (
      <div className="price-chart">
        <div className="side-panel-title">{title}</div>
        <div className="history-empty">Gathering price data…</div>
      </div>
    );
  }

  return (
    <figure className={`m-0 ${embedded ? '' : 'price-chart'}`} aria-label={`Price chart of ${coin} over the last 10 minutes`}>
      {!embedded && <figcaption className="side-panel-title">{title}</figcaption>}
      <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 400, height: 240 }}>
        <LineChart data={data}>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            stroke="#6b7590"
            fontSize={10}
            minTickGap={40}
          />
          <YAxis
            domain={['auto', 'auto']}
            stroke="#6b7590"
            fontSize={10}
            tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            width={70}
          />
          <Tooltip
            contentStyle={{ background: '#13151e', border: '1px solid #1e2330', fontSize: 12 }}
            labelFormatter={(t) => new Date(t).toLocaleTimeString()}
            formatter={(v) => [`€${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Price']}
          />
          {bets
            .filter((bet) => bet.coin === coin)
            .map((bet) => (
              <ReferenceLine
                key={bet.id}
                y={bet.entryPrice}
                stroke={bet.direction === 'UP' ? '#2ea84b' : '#e05252'}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            ))}
          <Line type="monotone" dataKey="price" stroke="#e8a020" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
