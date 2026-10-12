import { useCallback, useEffect, useState } from 'react';
import CoinSelector from '../components/CoinSelector';
import PriceDisplay from '../components/PriceDisplay';
import BetSection from '../components/BetSection';
import ActiveBets from '../components/ActiveBets';
import HistoryList from '../components/HistoryList';
import PriceChart from '../components/PriceChart';
import LiveFeed from '../components/LiveFeed';
import { useApp, usePrices, useSocketEvent } from '../context/AppContext';
import { getActiveBets, getBets, getFeed, placeBet } from '../api/bets';
import { validateBetAmount } from '../utils/validation';
import { formatDuration } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const FEED_SIZE = 30;

function addUnique(list, bet) {
  return list.some((b) => b.id === bet.id) ? list : [...list, bet];
}

// Main page: pick a coin, a direction (UP/DOWN), an amount and a duration.
// The server takes the entry price and settles the bet when it expires.
export default function TradePage({ onLoginRequest }) {
  useDocumentTitle('Trade');
  const { user, setUser, rules } = useApp();
  const prices = usePrices();

  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [betAmount, setBetAmount] = useState('100');
  const [duration, setDuration] = useState(60);
  const [sidePanelView, setSidePanelView] = useState('chart'); // 'chart' | 'bets' | 'feed'
  const [activeBets, setActiveBets] = useState([]);
  const [history, setHistory] = useState([]);
  const [feed, setFeed] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [betStatus, setBetStatus] = useState({ text: '', type: '' });
  const [betError, setBetError] = useState('');

  const coins = rules?.coins ?? ['BTC', 'ETH'];
  const priceInfo = prices[selectedCoin];
  const userId = user?.id;

  // My open bets and last results (reloaded after login or a reconnection).
  const loadMyBets = useCallback(async () => {
    if (!userId) {
      setActiveBets([]);
      setHistory([]);
      return;
    }
    try {
      const [active, recent] = await Promise.all([getActiveBets(), getBets({ limit: 20 })]);
      setActiveBets(active);
      setHistory(recent.data.filter((b) => b.status !== 'PENDING').slice(0, 8));
    } catch {
      // errors are shown by the toast/session handlers
    }
  }, [userId]);

  useEffect(() => {
    loadMyBets();
  }, [loadMyBets]);

  useEffect(() => {
    getFeed()
      .then((bets) =>
        setFeed(bets.map((bet) => ({ ...bet, kind: bet.status === 'PENDING' ? 'bet' : 'settled' })))
      )
      .catch(() => {});
  }, []);

  useSocketEvent('connect', loadMyBets);

  useSocketEvent('bet:placed', (bet) => setActiveBets((list) => addUnique(list, bet)));

  useSocketEvent('bet:settled', ({ bet }) => {
    setActiveBets((list) => list.filter((b) => b.id !== bet.id));
    setHistory((list) => [bet, ...list.filter((b) => b.id !== bet.id)].slice(0, 8));
  });

  useSocketEvent('feed:bet', (bet) => setFeed((list) => [{ ...bet, kind: 'bet' }, ...list].slice(0, FEED_SIZE)));
  useSocketEvent('feed:settled', (bet) => setFeed((list) => [{ ...bet, kind: 'settled' }, ...list].slice(0, FEED_SIZE)));

  function handleAmountChange(value) {
    setBetAmount(value);
    setBetError('');
  }

  async function handleBet(direction) {
    if (!user) {
      onLoginRequest();
      return;
    }

    const error = validateBetAmount(betAmount, {
      minBet: rules?.minBet,
      maxBet: rules?.maxBet,
      balance: user.wallet,
    });
    if (error) {
      setBetError(error);
      return;
    }

    setPlacing(true);
    setBetError('');
    try {
      const { bet, wallet } = await placeBet({
        coin: selectedCoin,
        direction,
        amount: Number(betAmount),
        duration,
      });
      setActiveBets((list) => addUnique(list, bet));
      setUser((u) => (u ? { ...u, wallet } : u));
      setBetStatus({
        text: `${direction} on ${selectedCoin} · ${formatDuration(duration)} · entry €${bet.entryPrice.toLocaleString('en-US')}`,
        type: direction === 'UP' ? 'up' : 'down',
      });
    } catch (err) {
      setBetError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  const tabs = [
    { id: 'chart', label: 'Chart' },
    { id: 'bets', label: `My bets${activeBets.length ? ` (${activeBets.length})` : ''}` },
    { id: 'feed', label: 'Live' },
  ];

  return (
    <div className="page-content">
      <h1 className="sr-only">Trade</h1>
      <div className="trading-layout">
        <div className="trading-panel">
          <CoinSelector coins={coins} selectedCoin={selectedCoin} onSelect={setSelectedCoin} />
          <PriceDisplay coin={selectedCoin} info={priceInfo} />
          <BetSection
            rules={rules}
            balance={user?.wallet ?? 0}
            isLoggedIn={Boolean(user)}
            betAmount={betAmount}
            onAmountChange={handleAmountChange}
            duration={duration}
            onDurationChange={setDuration}
            onBet={handleBet}
            placing={placing}
            betStatus={betStatus}
            error={betError}
            priceReady={Boolean(priceInfo?.price)}
          />
        </div>

        <div className="side-panel">
          <div className="side-panel-tabs" role="tablist" aria-label="Side panel">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={sidePanelView === tab.id}
                className={`side-tab-btn ${sidePanelView === tab.id ? 'active' : ''}`}
                onClick={() => setSidePanelView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {sidePanelView === 'chart' && (
              <PriceChart coin={selectedCoin} data={priceInfo?.history ?? []} bets={activeBets} />
            )}

            {sidePanelView === 'bets' &&
              (user ? (
                <div className="flex flex-col gap-4">
                  <ActiveBets bets={activeBets} prices={prices} />
                  <HistoryList history={history} />
                </div>
              ) : (
                <div className="history-panel">
                  <div className="history-empty">Log in to see your bets</div>
                </div>
              ))}

            {sidePanelView === 'feed' && <LiveFeed items={feed} />}
          </div>
        </div>
      </div>
    </div>
  );
}
