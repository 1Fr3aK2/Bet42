// Game rules. GET /api/bets/rules sends these to the frontend so the
// client never hardcodes them.

export const SUPPORTED_COINS = ['BTC', 'ETH'];

// Allowed bet durations, in seconds (1 minute and 5 minutes).
export const BET_DURATIONS = [60, 300];

// A winning bet pays stake × PAYOUT_MULTIPLIER (stake included).
export const PAYOUT_MULTIPLIER = 1.85;

export const MIN_BET = 1;
export const MAX_BET = 100_000;

// Open (pending) bets a user can have at the same time.
export const MAX_PENDING_BETS = 10;

// T$ credited to every new account.
export const STARTING_BALANCE = 1000;

// How often the settlement loop looks for expired bets.
export const SETTLEMENT_INTERVAL_MS = 1000;

// If a bet still cannot be settled this long after it expired (price feed
// down), it is refunded instead of staying open forever.
export const SETTLEMENT_GRACE_MS = 2 * 60 * 1000;

export function potentialPayout(amount: number): number {
  return Math.floor(amount * PAYOUT_MULTIPLIER);
}
