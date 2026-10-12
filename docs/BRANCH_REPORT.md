# Branch report — `mcarepa-final`

What this branch fixes and adds on top of `dev` (merge of PR #51), so the team
can review it and knows what changed in each area. Details of every module are
in the [README](../README.md); a demo script for the evaluation is in
[EVALUATION.md](EVALUATION.md).

## Summary

- The project now passes the mandatory part: bets live on the server, legal
  pages exist, login uses email, forms are validated on both sides, the site is
  responsive and accessible, the README is complete.
- **22 module points** are claimed (14 required + bonus, capped at 5).
- The full stack (app, WAF, Vault, ELK, Prometheus/Grafana) starts with `make`
  on a clean machine, survives `make down` + `make`, a reboot and `make re`.
- Several infrastructure bugs that would have failed the evaluation were found
  by running everything end to end and are fixed (section 3).

## 1. Mandatory requirements

| Problem on `dev` | Fix |
|------------------|-----|
| Bets were simulated in the browser (local balance of 1,000 T$, fake prices, nothing stored, results decided by the client) | Server-side betting engine: the server takes the Kraken price, stores the bet, debits the wallet atomically and settles the bet after 1 or 5 minutes |
| No Privacy Policy or Terms of Service | Both pages, written for this app, linked from the footer and the registration form |
| Login by username only (subject: email + password) | Login by email (username still accepted for scripts) |
| The client chose the starting balance (`POST /users` with any `wallet`) | Server sets 1,000 T$ and records it in a wallet ledger; unknown fields are rejected |
| Several multi-user race conditions possible on the balance | Conditional SQL update: 8 simultaneous bets of 300 T$ with 1,000 T$ → exactly 3 accepted |
| Not responsive; several texts below WCAG contrast | Tablet/phone layouts; axe-core reports 0 WCAG 2.1 AA violations on 16 pages and dialogs |
| No CSS framework | Tailwind CSS added (the original stylesheet kept in a lower cascade layer, same look) |
| Weak validation (no username/password rules, any avatar) | Same rules in the frontend and in the NestJS DTOs for every form; avatars checked by type, size and file signature |
| Empty README | README with every section required by the subject |
| Browser console errors (Vite dev server behind nginx, failed requests) | Production build served by nginx; expired sessions and taken usernames handled without failed requests; 0 console errors in the full browser test |

## 2. New features

**Trading engine** (`backend/src/bets`, `wallet`, `frontend/src/pages/TradePage.jsx`)
- `POST /api/bets`, `/api/bets/active`, `/api/bets`, `/api/bets/rules`, `/api/bets/feed`
- Settlement loop every second, idempotent, resumes bets after a restart; refunds on equal price or feed outage
- Wallet ledger (`WalletTransaction`): every balance change recorded (stake, payout, refund, bonus, admin correction)
- Open bets with countdown and "winning/losing/even", entry prices drawn on the chart, live feed of all players

**Real time** (`backend/src/realtime`)
- One Socket.IO gateway: JWT on the socket, private room per user, throttled prices with a 10-minute snapshot on connect, live feed, online counter, pushes for role changes and account deletion, connection badge and automatic resync in the client

**Gamification** (`backend/src/gamification`, Rewards page)
- XP and levels, 12 achievements stored in the database, win streaks, daily bonus with streak, leaderboard (balance / XP / wins), public player profiles

**Analytics** (`backend/src/analytics`, Dashboard page)
- Balance, cumulative profit, daily profit, outcomes and activity-by-hour charts, KPI tiles, date/coin/duration/direction filters, live reload, CSV / JSON / PDF export, table view for every chart, platform view for admins

**Users and permissions** (`backend/src/users`, `friends`, Admin / Moderation / Friends pages)
- Admin user management: search, view, edit (username, email, balance), change role, delete
- Moderation page for moderators and admins (held content, reports, log) on the existing forum endpoints
- Friends: requests, accept/decline/cancel, friends list with live online status (on Pedro's `Friendship` model)
- Avatar upload resized in the browser, generated default avatar, self-service account deletion, username availability check

**Monitoring**
- Business metrics on `/metrics` (`bets_placed_total`, `bets_wagered_tdollars_total`, `bets_settled_total`, `ws_connected_clients`) and a *Trading activity* row in the Grafana dashboard

**Documentation**
- README, `docs/EVALUATION.md`, `backend/src/bets/README.md`, `backend/src/users/README.md` rewritten, WAF exclusions documented in `nginx/modsecurity/WAF_HARDENING.md`

## 3. Bugs fixed in the existing infrastructure

| Bug | Effect | Fix |
|-----|--------|-----|
| `vault-init.sh` revoked the root token, then reused it on every later start | A second `make` (or `make down` + `make`) looped on `vault_init`; the backend never started | Already-configured Vault is only unsealed |
| Backend crashed when Vault was sealed (after a reboot) and `nest --watch` kept the dead container "up" | Site down after a reboot, even after `make` | Secret loading retries until Vault is unsealed |
| ModSecurity blocked Grafana's and Prometheus' PromQL queries (SQLi/RCE false positives) | Every Grafana panel using `by (...)` showed "No data" | Exclusions limited to the query fields of the two query endpoints |
| ModSecurity blocked ~20% of avatar uploads (random base64) | Avatar upload failed at random | Exclusion limited to the `avatar` field of `PATCH /users/me` |
| `README.md` inside the Logstash pipeline folder | Logstash exited on start: no logs in Elasticsearch | README moved to `logging/logstash/` |
| Filebeat config group-writable (host umask 002) | Filebeat restarted forever | Permissions fixed in the image |
| Logstash X-Pack monitoring without credentials | 401 error logged every 30 s | Disabled (unused) |
| `make fclean` stopped and deleted **every** container, image and volume of the machine | Destroys other projects of the evaluator | Only this project's resources |
| `setup-certs.sh` ran `sudo apt install mkcert` | `make` fails without sudo | `openssl` local CA when `mkcert` is missing |
| No `.env` → `make` failed | Not a single command on a clean clone | `.env` generated with random secrets |
| Rootless Docker cannot bind 80/443 | `make` fails on rootless machines | Detected; 8443/8080 used automatically |
| Backend `.dockerignore` inside `src/` | Host `node_modules` copied into the image | Moved to the build context root |
| Frontend health check on `localhost` (IPv6) | Frontend never healthy, nginx never started | `127.0.0.1` |
| npm downloads timed out during the image build on a slow network | `make` stopped with ETIMEDOUT | npm retries and longer timeouts in both Dockerfiles |

## 4. Modules (22 points)

| Module | Type | Status |
|--------|------|--------|
| Frameworks (React + NestJS) | Major | existing |
| Real-time WebSockets | Major | strengthened on this branch |
| Public API | Major | existing |
| Standard user management | Major | **completed** (friends + online status, avatars, profiles) |
| Advanced permissions | Major | **completed** (user CRUD, role-based pages) |
| WAF/ModSecurity + Vault | Major | existing, fixed |
| ELK | Major | existing, **fixed (did not start)** |
| Prometheus + Grafana | Major | existing, **fixed (panels blocked)** + business metrics |
| Advanced analytics dashboard | Major | **new** |
| ORM (Prisma) | Minor | existing |
| Advanced search (forum) | Minor | existing |
| Gamification | Minor | **new** |
| Health check, status page, backups | Minor | existing |

Not claimed: Content moderation AI (the engine is rule-based), multiple languages,
additional browsers, blockchain, OAuth.

## 5. What changed in each person's area (please review)

- **Rafael** — `Makefile`, `scripts/setup-env.sh`, `scripts/setup-certs.sh`, `docker-compose.yml`
  (port variables, health checks, Logstash env), `nginx/template/default.conf.template`
  (`/api/` location, redirect with port), `nginx/modsecurity/before-crs.conf` +
  `WAF_HARDENING.md`, `vault/config/vault-init.sh` (step 2b), `backend/src/vault/vault-bootstrap.ts`
  (retry), `logging/filebeat/Dockerfile`, Logstash README moved, Grafana dashboard (rows 13-19)
- **Pedro** — `backend/src/auth` (email login, account check in `JwtStrategy`, `JwtModule`
  exported), `backend/src/users` (DTOs, admin CRUD, deletion, avatar, availability, profile),
  `backend/src/crypto/kraken.service.ts` (feed health, history; `CryptoGateway` replaced by
  `realtime/`), Prisma schema (new tables, `Friendship` from your draft)
- **Duarte** — frontend restructured: Tailwind, React Router, `context/`, `pages/`, `api/client.js`,
  UI kit in `components/ui`; modified `BetSection`, `ActiveBets`, `HistoryList`, `PriceChart`,
  `PriceDisplay`, `CoinSelector`, `Navbar`, `ProfileDropdown`, `LoginModal`, `RegisterModal`,
  `SettingsPage`, `Toast`; removed `Timer.jsx` and `data/constants.js`; `style.css` contrast and
  responsive rules; production `Dockerfile` + `nginx.conf`
- **Hugo** — forum unchanged except two `aria-label`s in `ForumPage.jsx`; forum relations now
  cascade when a user is deleted and `ModerationLog.moderatorId` became optional; the new
  Moderation page uses your endpoints

## 6. Tests run

| Test | Result |
|------|--------|
| API test through nginx + WAF (validation, race, settlement, gamification, friends, exports, admin, Public API, deletion) | 64/64 |
| Browser test in Chrome (guest, register, bet, rewards, dashboard, friends, settings + avatar, forum, phone layout, admin) | 0 console errors, 0 failed requests |
| Two players at once (live feed, friend requests, online status, backend restart) | all passed |
| axe-core WCAG 2.1 A/AA on 16 pages and dialogs | 0 violations |
| WAF: attacks in other fields / URLs after the exclusions | still 403 |
| `make re` from scratch (new certificates, Vault init, 4 migrations, seed, ELK, monitoring) | all containers healthy |
| Reboot, then `make` | Vault unsealed, backend resumed |

Not tested: browsers other than Chrome.

## 7. Still to do before the evaluation

1. README: replace the placeholders (five 42 logins on the first line), confirm the roles,
   complete each member's contribution and use of AI (marked `TODO(team)`).
2. Review this branch and merge it into `dev` through a pull request.
3. Everyone reads `docs/EVALUATION.md` and can explain and modify their part.

## 8. How to launch

```bash
make            # creates .env and certificates if missing, builds, starts, waits
```

Then open the URL printed at the end (`https://localhost`, or `https://localhost:8443`
on rootless Docker) and log in with the admin account it prints. Other commands:
`make ps`, `make logs SERVICE=backend`, `make down`, `make re` (full reset).
Requirements: Docker with the Compose v2 plugin, GNU make, openssl.
