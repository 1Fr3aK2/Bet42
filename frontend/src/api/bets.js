import { apiFetch, toQuery } from './client';

// Game rules decided by the server (coins, durations, payout, limits).
export function getRules() {
  return apiFetch('/api/bets/rules');
}

export function placeBet({ coin, direction, amount, duration }) {
  return apiFetch('/api/bets', { method: 'POST', body: { coin, direction, amount, duration } });
}

export function getActiveBets() {
  return apiFetch('/api/bets/active');
}

export function getBets(params) {
  return apiFetch(`/api/bets${toQuery(params)}`);
}

// Latest bets of all players (live activity feed)
export function getFeed() {
  return apiFetch('/api/bets/feed');
}
