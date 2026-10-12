# Users Module (`backend/src/users`)

## What it does

Manages user accounts: registration, profile, avatar, password, account
deletion, public profiles and, for administrators, user management (view,
edit, delete, change role). Users can only modify their own account; every
operation on another account requires the `ADMIN` role.

Validation rules shared by the DTOs live in `user-validation.ts` (the frontend
applies the same rules in `frontend/src/utils/validation.js`).

| Field | Rule |
|-------|------|
| `username` | 3-20 characters, letters, numbers and `_`; unique ignoring case |
| `email` | valid email, max 254, stored lowercase, unique |
| `password` | 8-72 characters with at least one letter and one number; stored as a bcrypt hash (10 rounds, salted) |
| `avatar` | PNG/JPEG/WebP/GIF data URL, max 200,000 characters (the browser resizes images to 256×256 first) |

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/users` | public | Register. Body `{ username, email, password }`. The server sets the starting balance (1,000 T$) and writes a `SIGNUP_BONUS` ledger entry. Sending `wallet` or any unknown field returns `400`. |
| `GET` | `/users/availability?username=&email=` | public | `{ username: bool, email: bool }` — `true` when still free (used by the registration form). |
| `GET` | `/users/me` | JWT | Own account (wallet, xp, level, role, avatar, avatarUrl...). |
| `PATCH` | `/users/me` | JWT | Update `username` and/or `avatar` (`null` removes the avatar). |
| `DELETE` | `/users/me` | JWT | Delete own account; body `{ password }`. Not allowed for `ADMIN`. |
| `PATCH` | `/users/password` | JWT | Body `{ currentPassword, newPassword }`. |
| `GET` | `/users/:id/avatar` | public | Uploaded avatar, or a generated SVG default avatar. Cached 1 day (`?v=` busts it). |
| `GET` | `/users/:id/profile` | public | Public profile: level, stats, win rate, achievements, last settled bets. No email. |
| `GET` | `/users?search=&role=` | ADMIN | List accounts (search in username/email, filter by role). |
| `GET` | `/users/:id` | ADMIN | Account details with counts (bets, posts, comments, achievements) and latest bets. |
| `PATCH` | `/users/:id` | ADMIN | Edit `username`, `email`, `wallet`. A balance change is recorded as `ADMIN_ADJUSTMENT` in the wallet ledger. Other admins cannot be edited. |
| `DELETE` | `/users/:id` | ADMIN | Delete an account. Admins cannot be deleted, nor can the caller delete themselves here. |
| `PATCH` | `/users/:id/role` | ADMIN | Body `{ role: "USER" \| "MODERATOR" }`. The `ADMIN` role cannot be given or removed. |

Errors follow the NestJS format, for example:

```json
{ "statusCode": 409, "message": "This username is already taken", "error": "Conflict" }
```

Validation errors return `400` with `message` as an array of messages.

## Account deletion

Deleting an account (by the user or by an admin) removes, through the
`ON DELETE CASCADE` foreign keys, the user's bets, wallet ledger, achievements,
friendships, posts, comments and reports. Reports that target the user's posts
or comments are deleted in the same transaction. Moderation log entries are
kept with `moderatorId = null`. The user's open browser tabs receive
`session:revoked` and are logged out; their token is rejected afterwards
because `JwtStrategy` checks that the account still exists.

## Real-time notifications

`user.updated` (role or profile changed by an admin) and `user.deleted` events
are pushed to the user's sockets by `RealtimeGateway` (`session:refresh` /
`session:revoked`), so menus and permissions change without reloading.

## Available roles

| Role | Can |
|------|-----|
| guest (not logged in) | watch prices, the live feed, the leaderboard, public profiles, legal pages |
| `USER` | bet, claim rewards, dashboard, friends, forum, settings |
| `MODERATOR` | everything a user can + moderation queue, reports, moderation log |
| `ADMIN` | everything + user management, platform analytics, Public Admin API key |

## Module structure

```
users/
├── users.controller.ts      # routes (static routes before ":id")
├── users.service.ts         # business logic, ledger, deletion, avatars
├── users.module.ts
├── user-validation.ts       # shared patterns and messages
├── create-user.dto.ts
├── update-me.dto.ts
├── update-password.dto.ts
├── update-user-role.dto.ts
├── admin-update-user.dto.ts
├── delete-account.dto.ts
├── list-users.dto.ts
└── availability.dto.ts
```
