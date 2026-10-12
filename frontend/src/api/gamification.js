import { apiFetch, toQuery } from './client';

export function getMyProgress() {
  return apiFetch('/api/gamification/me');
}

export function claimDailyBonus() {
  return apiFetch('/api/gamification/daily-bonus', { method: 'POST' });
}

export function getLeaderboard({ sort = 'balance', limit = 50 } = {}) {
  return apiFetch(`/api/leaderboard${toQuery({ sort, limit })}`);
}
