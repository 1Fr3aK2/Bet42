import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../api/socket';
import { getMe } from '../api/users';
import { getRules } from '../api/bets';
import { SESSION_EXPIRED_EVENT } from '../api/client';
import { formatTD } from '../utils/format';

// Global state shared by every page:
//   session (token + user), game rules, connection status, online players
//   and toast notifications.
// Live prices change twice per second, so they have their own context:
// only the components that show prices re-render on each tick.
const AppContext = createContext(null);
const PriceContext = createContext({});

const HISTORY_WINDOW_MS = 10 * 60 * 1000;

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser'));
  } catch {
    return null;
  }
}

// Drops a saved token that has already expired (checked locally from the
// JWT "exp" claim), so the first page load does not send a doomed request.
function readStoredToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 > Date.now()) return token;
  } catch {
    // malformed token
  }

  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  return null;
}

function tickerToPrice(ticker, history) {
  return {
    price: ticker?.last ?? null,
    high: ticker?.high ?? null,
    low: ticker?.low ?? null,
    volume: ticker?.volume ?? null,
    changePct: ticker?.change_pct ?? null,
    history,
  };
}

export function AppProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(() => (localStorage.getItem('token') ? readStoredUser() : null));
  const [rules, setRules] = useState(null);
  const [prices, setPrices] = useState({});
  const [connection, setConnection] = useState('connecting');
  const [presence, setPresence] = useState({ connections: 0, traders: 0 });
  const [toasts, setToasts] = useState([]);
  const wasConnected = useRef(false);

  // Keep the profile across page reloads (refreshed from the server on load).
  useEffect(() => {
    if (user) localStorage.setItem('currentUser', JSON.stringify(user));
    else localStorage.removeItem('currentUser');
  }, [user]);

  const notify = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((list) => [...list.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('token')) return null;
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      return null; // a 401 logs out through SESSION_EXPIRED_EVENT
    }
  }, []);

  // Reconnect the socket so the server sees the new token (or none).
  const reconnectSocket = useCallback(() => {
    socket.disconnect();
    socket.connect();
  }, []);

  const login = useCallback(
    async (accessToken) => {
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
      const me = await getMe(accessToken);
      setUser(me);
      reconnectSocket();
      return me;
    },
    [reconnectSocket]
  );

  const logout = useCallback(
    (message) => {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      setToken(null);
      setUser(null);
      reconnectSocket();
      if (message) notify(message, 'info');
    },
    [notify, reconnectSocket]
  );

  // Any 401 from the API means the token is no longer valid.
  useEffect(() => {
    const onExpired = () => {
      // Several requests can fail at once: log out only the first time.
      if (localStorage.getItem('token')) logout('Your session has ended. Please log in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  // First load: game rules + fresh profile.
  useEffect(() => {
    getRules().then(setRules).catch(() => {});
    refreshUser();
  }, [refreshUser]);

  // Socket.IO: one set of listeners for the whole app.
  useEffect(() => {
    function onConnect() {
      setConnection('live');
      if (wasConnected.current) refreshUser(); // resync after a network drop
      wasConnected.current = true;
    }

    function onDisconnect(reason) {
      // "io client disconnect" = we reconnect on purpose after login/logout.
      setConnection(reason === 'io client disconnect' ? 'connecting' : 'reconnecting');
    }

    function onConnectError() {
      setConnection(socket.active ? 'reconnecting' : 'offline');
    }

    function onSnapshot(snapshot) {
      setPrices(() => {
        const next = {};
        for (const { symbol, ticker, history } of snapshot) {
          next[symbol.split('/')[0]] = tickerToPrice(ticker, history ?? []);
        }
        return next;
      });
    }

    function onTicker(ticker) {
      const coin = ticker.symbol.split('/')[0];
      const now = Date.now();

      setPrices((prev) => {
        const history = [...(prev[coin]?.history ?? [])];
        const last = history[history.length - 1];

        if (last && now - last.time < 1000) history[history.length - 1] = { time: last.time, price: ticker.last };
        else history.push({ time: now, price: ticker.last });

        const cutoff = now - HISTORY_WINDOW_MS;
        while (history.length && history[0].time < cutoff) history.shift();

        return { ...prev, [coin]: tickerToPrice(ticker, history) };
      });
    }

    function onWallet({ wallet }) {
      setUser((u) => (u ? { ...u, wallet } : u));
    }

    function onBetSettled({ bet, wallet, xp, level }) {
      setUser((u) => (u ? { ...u, wallet, xp, level } : u));

      const label = `${bet.coin} ${bet.direction} · ${bet.duration / 60} min`;
      if (bet.status === 'WON') notify(`✓ Won ${label} · ${formatTD(bet.payout - bet.amount, { sign: true })}`, 'win');
      else if (bet.status === 'LOST') notify(`✗ Lost ${label} · ${formatTD(-bet.amount)}`, 'loss');
      else notify(`↺ Refunded ${label} · price unchanged`, 'info');
    }

    function onAchievements({ achievements }) {
      achievements.forEach((a) =>
        notify(`${a.icon} Achievement unlocked: ${a.name} (+${a.xpReward} XP)`, 'achievement')
      );
    }

    function onLevelUp({ level }) {
      setUser((u) => (u ? { ...u, level } : u));
      notify(`★ Level up! You are now level ${level}`, 'achievement');
    }

    function onRevoked({ reason } = {}) {
      if (localStorage.getItem('token')) logout(reason || 'You have been logged out.');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('crypto:snapshot', onSnapshot);
    socket.on('crypto:ticker', onTicker);
    socket.on('presence:update', setPresence);
    socket.on('wallet:update', onWallet);
    socket.on('bet:settled', onBetSettled);
    socket.on('achievement:unlocked', onAchievements);
    socket.on('level:up', onLevelUp);
    socket.on('session:refresh', refreshUser);
    socket.on('session:revoked', onRevoked);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('crypto:snapshot', onSnapshot);
      socket.off('crypto:ticker', onTicker);
      socket.off('presence:update', setPresence);
      socket.off('wallet:update', onWallet);
      socket.off('bet:settled', onBetSettled);
      socket.off('achievement:unlocked', onAchievements);
      socket.off('level:up', onLevelUp);
      socket.off('session:refresh', refreshUser);
      socket.off('session:revoked', onRevoked);
      socket.disconnect();
    };
  }, [logout, notify, refreshUser]);

  const value = useMemo(
    () => ({
      token,
      user,
      setUser,
      isAdmin: user?.role === 'ADMIN',
      isModerator: user?.role === 'MODERATOR' || user?.role === 'ADMIN',
      login,
      logout,
      refreshUser,
      rules,
      connection,
      presence,
      toasts,
      notify,
      dismissToast,
    }),
    [token, user, login, logout, refreshUser, rules, connection, presence, toasts, notify, dismissToast]
  );

  return (
    <AppContext.Provider value={value}>
      <PriceContext.Provider value={prices}>{children}</PriceContext.Provider>
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

// { BTC: { price, high, low, volume, changePct, history }, ETH: ... }
export function usePrices() {
  return useContext(PriceContext);
}

// Subscribes a component to a socket event for as long as it is mounted.
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (...args) => handlerRef.current(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event]);
}
