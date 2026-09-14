# Login Audit Logging (small, self-contained backend increment)

## Objective
Record login activity so admins can see who is logging in (and who is failing to log in).
Fills a documented gap: the app has no way to attribute logins to users — only CRUD + AI
chat events land in `activity_log`.

## Assumptions
- `activity_log` table already exists with columns `(id, user_id, action, entity_type,
  entity_id, entity_name, details, created_at)` and an index on `(entity_type, entity_id)`.
- A helper `logActivity(userId, action, entityType, entityId, entityName, details)` already
  exists in `backend/services/activity.js` and is used by other routes (tasks, comments).
- The login flow is in `backend/routes/auth.js` (`POST /login`, `POST /register`), using
  `db` directly. It currently never writes to `activity_log`.
- `activity_log` has no per-row uniqueness constraint that would break inserts; adding rows
  is safe and additive. No schema change needed.

## Scope
### In
- On **successful login**: `logActivity(user.id, 'user.login', 'user', user.id, user.email, null)`.
- On **failed login** (bad password or unknown email): 
  `logActivity(knownUserIdOrNull, 'user.login.failed', 'user', knownUserIdOrNull, attemptedEmail, { reason: 'invalid_credentials' })`.
- On **user registration**: `logActivity(newUser.id, 'user.registered', 'user', newUser.id, newUser.email, null)`.
- Keep `last_login_at` update on successful login (already present — do not remove).
### Out
- No DB schema / migration changes.
- No frontend changes (login history is visible via the existing `/api/activity` route,
  e.g. `GET /api/activity?entity_type=user`).
- No new endpoints, no new tables, no password/email logging beyond the email already
  returned by the login route.

## Success Criteria
1. Successful login inserts a `user.login` row with `user_id`, `entity_id`, `entity_name` = email.
2. Failed login (wrong password OR unknown email) inserts a `user.login.failed` row with the
   attempted email in `entity_name`/`details`.
3. Registration inserts a `user.registered` row.
4. `GET /api/activity?entity_type=user` returns the new login rows with `user_name` populated.
5. Backend starts cleanly and existing auth behavior is unchanged (valid login still returns
   token+user; invalid still 401; duplicate register still 409).

## Constraints
- Do **not** edit `backend/db.js`. Do not run any destructive or DB-writing commands.
- No secrets, passwords, or tokens in `details` — only the email (the same email the route
  already exposes) and a fixed reason string.
- Use the existing `logActivity` helper; do not hand-write SQL inserts.
- Keep the change minimal and consistent with existing route style.

## Verification
- `node --check` on the edited route, or start backend and exercise login/register with curl
  against a COPY of the live DB; confirm rows appear in `activity_log` and `/api/activity`.
- Existing auth tests/behavior pass (valid/invalid/duplicate).
