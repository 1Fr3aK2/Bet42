# Bets Module (`backend/src/bets`)

The trading game: a player predicts whether the price of BTC or ETH (in EUR,
from Kraken) will be **UP** or **DOWN** after **1 or 5 minutes**.

## Rules (`bets.constants.ts`)

| Rule | Value |
|------|-------|
| Coins | `BTC`, `ETH` |
| Durations | 60 s, 300 s |
| Stake | 1 – 100,000 T$, never more than the balance |
| Payout | win = `floor(stake × 1.85)` (stake included); loss = 0 |
| Same price at expiry | stake refunded |
| Open bets | max 10 per user; max 20 new bets per minute (Redis) |
| Feed down at expiry | settlement waits; after 2 minutes the bet is refunded |

`GET /api/bets/rules` returns these values so the frontend never hardcodes them.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/bets/rules` | public | rules above + `feedHealthy` |
| `GET` | `/api/bets/feed` | public | last 15 bets of all players (live activity) |
| `POST` | `/api/bets` | JWT | `{ coin, direction, amount, duration }` → `{ bet, wallet, xp, level, unlocked }` |
| `GET` | `/api/bets/active` | JWT | own open bets |
| `GET` | `/api/bets?status=&coin=&page=&limit=` | JWT | own bets, newest first, paginated |

## Placing a bet (`bets.service.ts`)

1. Rate limit and validation (DTO).
2. The **entry price is read on the server** (`KrakenService.getLivePrice`). The
   client never sends a price. If the feed is down, `503`.
3. In one database transaction:
   - count open bets (max 10);
   - create the bet;
   - `WalletService.debit`: `UPDATE "User" SET wallet = wallet - amount WHERE id = ? AND wallet >= amount`.
     The check and the update are one statement, so when several requests race,
     PostgreSQL row locking lets only the ones the balance can pay go through
     (tested: 8 parallel bets of 300 T$ with 1,000 T$ → exactly 3 accepted);
   - write a `BET_STAKE` entry in the wallet ledger;
   - add XP and unlock achievements (`GamificationService.evaluate`).
   If any step fails, everything is rolled back.
4. After the commit: Prometheus counters, `bet.placed` and `wallet.changed` events
   (pushed to the browser by `RealtimeGateway`).

## Settling bets (`bets-settlement.service.ts`)

A loop runs every second and loads the `PENDING` bets whose `expiresAt` has passed
(index `Bet(status, expiresAt)`). For each one, `decideOutcome(bet, exitPrice)`
gives `WON` / `LOST` / `REFUNDED`, then one transaction:

- `UPDATE ... WHERE id = ? AND status = 'PENDING'` — only one settlement can win,
  so a bet is never paid twice, even with two backend instances;
- credits the payout or refund with a ledger entry (`BET_PAYOUT` / `BET_REFUND`);
- updates wins, losses, win streak, best streak and XP; unlocks achievements.

Because the loop reads the database, bets that expired while the backend was
stopped are settled as soon as it starts again.

## Real-time events

| Event (server → browser) | To | When |
|--------------------------|----|------|
| `bet:placed` | the player's tabs | a bet was accepted |
| `bet:settled` | the player's tabs | result, new wallet, xp, level |
| `wallet:update` | the player's tabs | any balance change |
| `feed:bet` / `feed:settled` | everyone | live activity feed |
| `leaderboard:changed` | everyone | debounced, after settlements |

## Metrics

`bets_placed_total{coin,direction,duration}`, `bets_wagered_tdollars_total{coin}`,
`bets_settled_total{status,coin}` on `/metrics`, shown in the Grafana dashboard
("Trading activity" row).
