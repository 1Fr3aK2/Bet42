# Evaluation guide

How to demonstrate each mandatory requirement and each claimed module.
Start with `make`, open the URL it prints and keep the browser console open
(F12): it must stay free of errors and warnings during the normal flows.

The admin login is printed by `make` (also in `.env`: `ADMIN_EMAIL`,
`ADMIN_PASSWORD`). Use two browsers (or a normal and a private window) to show
multi-user behaviour.

## Mandatory part

| Requirement | How to show it |
|-------------|----------------|
| Single command | `make` on a clean clone (creates `.env`, certificates, builds, starts, waits) |
| HTTPS everywhere | `http://localhost` redirects to `https://`; backend, API and WebSocket go through nginx (TLS 1.2/1.3) |
| Frontend / backend / database | React (Vite build served by nginx), NestJS, PostgreSQL (`make ps`) |
| Sign up and log in with email + password | *Register* → *Login*; passwords are bcrypt hashes (`docker exec -it postgres psql -U user -d appdb -c 'select email, password from "User" limit 2'`) |
| Forms validated in the frontend and backend | Register with `ab` / `bad-email` / `short` → messages in the form; the same request with curl returns `400` with the DTO messages |
| Multi-user, no race conditions | Window A and B logged in as different players: bets of A appear live in B's *Live* tab, the leaderboard updates; balances can never go negative (concurrent debit is a single conditional SQL update) |
| Privacy Policy / Terms of Service | Footer links; also linked from the registration form |
| Responsive | Resize to phone width: menu collapses, panels stack |
| `.env` ignored, `.env.example` provided | `git check-ignore .env`, `cat .env.example` |
| Clear schema | `backend/prisma/schema.prisma`, README *Database Schema* |

## Modules

| Module | Demo |
|--------|------|
| Frameworks (React + NestJS) | `frontend/src`, `backend/src` module structure |
| WebSockets | Prices tick live; place a bet in window A → B's *Live* tab shows it; when it expires both see the result; stop the backend (`docker stop backend`) → badge shows *Reconnecting…*, start it → it resyncs |
| Public API | `curl -k -H "X-API-Key: $ADMIN_API_KEY" https://localhost/api/admin/users`; wrong key → 401; Swagger at `/api/admin/docs` with the header; `scripts/test-public-api.sh` |
| Standard user management | Settings: change username and avatar (default avatar before upload); *Friends*: add a player by username, accept in the other window, online dot changes when the other window closes; public profile page |
| Advanced permissions | Guest: can watch but not bet. User: no *Admin*/*Moderation* links, `/admin` shows *Access denied*. Admin: *Admin* page (search, view, edit balance, role USER↔MODERATOR, delete). Promote B to moderator → B's menu shows *Moderation* immediately |
| WAF + Vault | `curl -k "https://localhost/?q=<script>alert(1)</script>"` → 403 from ModSecurity; `docker exec vault vault status`; secrets are read by the backend through AppRole (`backend/src/vault/vault-bootstrap.ts`) |
| ELK | `/kibana/` (user `elastic`, `ELASTIC_PASSWORD`): container and WAF logs; ILM policy deletes indices after 14 days |
| Prometheus + Grafana | `/grafana/` (Grafana admin from `.env`): *Infra Status* dashboard, *Trading activity* row (bets, T$ wagered, WebSocket connections); alert rules in `/prometheus/` |
| Analytics dashboard | *Dashboard*: charts, filters (7/30/90 days, custom range, coin, duration, direction), *table* view, exports CSV/JSON/PDF; place a bet in another tab → the dashboard reloads by itself. Admin: *Platform* view |
| ORM | Prisma schema and migrations (`backend/prisma`) |
| Advanced search | Forum: search, sort, *My posts only*, date filter, pagination |
| Gamification | *Rewards*: level/XP bar, daily bonus (claim, then countdown), achievements unlock with a toast after the first bet/win; leaderboard by balance/XP/wins |
| Health / backups | `/status/` page, `curl -k https://localhost/health`, backups in `backups/postgres/`, restore procedure in `docs/backup-scripts/Disaster-Recovery.md` |

## Game rules (for questions)

UP/DOWN on BTC or ETH (EUR prices from Kraken), 1 or 5 minutes, stake 1–100,000 T$,
win pays 1.85× the stake, same price refunds, max 10 open bets. Entry and exit prices
are taken by the server; the settlement loop runs every second
(`backend/src/bets/README.md`).

## Typical live modifications

| Request | Where |
|---------|-------|
| Change the payout to 1.9 | `PAYOUT_MULTIPLIER` in `backend/src/bets/bets.constants.ts` (the UI reads it from `/api/bets/rules`) |
| Add a 3-minute duration | `BET_DURATIONS` in the same file (`[60, 180, 300]`) |
| Change the starting balance | `STARTING_BALANCE` in the same file |
| Change the daily bonus | `DAILY_BONUS_AMOUNT` in `backend/src/gamification/gamification.constants.ts` |
| Add an achievement | `ACHIEVEMENTS` in the same file + the condition in `bets.service.ts` / `bets-settlement.service.ts` |
| Add a column to bets | `backend/prisma/schema.prisma` → `npx prisma migrate dev --name <name>` |
| Add a coin | `SUPPORTED_COINS` in `bets.constants.ts` and `KRAKEN_SYMBOLS` in `crypto/kraken.service.ts` |
