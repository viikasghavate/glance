# Glance — Fix PG writer path: translate sqlite `datetime()/date()` to Postgres

## Objective
Make the Postgres engine (`DB_ENGINE=pg`) handle the sqlite-only SQL date functions
`datetime('now')`, `datetime('now','±N days')`, `date('now')`, and `date('now','±N days')`
so that WRITE/UPDATE statements (and any statement) that use them succeed on Postgres.

Currently `/api` reads pass parity, but a real write breaks at login:
`UPDATE users SET last_login_at = datetime('now') WHERE id = ?` fails on pg with
`function datetime(unknown) does not exist` (pg has no `datetime()`).

## Root cause
`backend/pg/client.js` `translateQ(sql)` only rewrites `?` -> `$1..$n` (skipping ? inside
string literals). It does NOT translate sqlite date functions. The read-parity harness
(`backend/pg/parity.js`) has its OWN separate `translateToPg` that DOES translate them — so
reads look fine in parity while the real app's writer path breaks. The app is the priority.

## Assumptions (verified)
- Routes call `db.prepare(sql).run/?/.get/?` from `backend/db.js`, which on `DB_ENGINE=pg`
  delegates to `backend/pg/client.js` `db.prepare(sql)` -> `translateQ(sql)` then runs the
  translated SQL against the pg pool/current-txn client.
- sqlite-only date forms used across `backend/routes/*.js` (exact inventory, 31 total):
  - `datetime('now')`                (24)
  - `date('now')`                    (3)
  - `datetime('now', '-7 days')`     (1)
  - `datetime('now', '-30 days')`    (1)
  - `date('now', '-30 days')`        (1)
  - `date('now', '+6 days')`         (1)
- `backend/pg/parity.js` `translateToPg` already contains the CORRECT date translation the
  app should mirror. Model the fix on it exactly (see below).
- `pg` package + `backend/node_modules/pg` are installed; Postgres container `glance-pg`
  (10.0.1.7) is up and migrated; `.pg/glance-pg.env` holds POSTGRES_USER/PASSWORD/DB.
- Postgres stores timestamps as TIMESTAMP; the app's code/tests expect the sqlite text
  format `YYYY-MM-DD HH:MM:SS` (or `YYYY-MM-DD` for date). Match parity.js outputs.

## Scope — touch ONLY
- `backend/pg/client.js` — extend `translateQ(sql)` to translate the four date forms
  BEFORE the `?`->`$N` pass (date translation replaces whole function literals and their
  string args; do it first so the later `?` pass doesn't misfire).

Do NOT touch `backend/db.js`, `backend/routes/*`, `backend/pg/parity.js`, `frontend/*`,
`package.json`. Do NOT change the sqlite default engine path. No schema/migration changes.

## Exact translation (mirror parity.js — keep outputs identical)
Reference logic already proven in `backend/pg/parity.js` `translateToPg`:
```
.replace(/datetime\('now'\)/g, "to_char(now(),'YYYY-MM-DD HH24:MI:SS')")
.replace(/datetime\('now',\s*'([^']+)'\)/g, (m, mod) => {
  const v = parseModifier(mod, true);   // '+6 days' -> " + interval '6 days'"; '-7 days' -> " - interval '7 days'"
  return `to_char(now()${v},'YYYY-MM-DD HH24:MI:SS')`;
})
.replace(/date\('now'\)/g, "to_char(CURRENT_DATE,'YYYY-MM-DD')")
.replace(/date\('now',\s*'([^']+)'\)/g, (m, mod) => {
  const v = parseModifier(mod, true);
  return `to_char(CURRENT_DATE${v},'YYYY-MM-DD')`;
})
```
where `parseModifier(mod)` (existing in parity.js): sign from leading `-`/`+`, extract N days,
return `''` if 0 days else ` + interval 'N days'` / ` - interval 'N days'`.

Port these four replaces (and a local parseModifier) into `translateQ` in `client.js`,
applied to the input sql BEFORE scanning for `?`. Keep the existing `?`->`$N` + string-literal
skip behavior intact (the replaced date calls don't contain `?`, so order is safe).

## Success criteria
1. `node --check backend/pg/client.js` passes; `npm run build` in `frontend/` still exits 0
   (unaffected, but run it as a regression gate).
2. With `DB_ENGINE=pg`, the app boots and:
   - `POST /api/auth/login` (admin@glance.local / admin123) returns 200 + token (this was
     the failing write).
   - `GET /api/projects`, `GET /api/analytics`, `GET /api/tasks/mine` return data via pg.
3. A write-verify against the pg DB (non-destructive to prod data — this is the dedicated
   glance-pg instance, it is separate from the prod sqlite): confirm `last_login_at` is a
   `YYYY-MM-DD HH:MM:SS`-format value after login (matches parity/format expectation).
4. The default engine (no `DB_ENGINE`) still boots and `/health` returns ok — prod path
   unchanged.

## Verification (run yourself after implementing)
Use the coding agent, but confirm with these manual commands from repo root:
```
cd backend
node --check pg/client.js
# boot pg engine on an isolated port against the pg instance:
DB_ENGINE=pg DB_PATH=/tmp/glance-boot-pg/glance.db PORT=3904 node server.js &
# login (was failing) + read APIs:
curl -s -X POST http://127.0.0.1:3904/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@glance.local","password":"admin123"}'
```
Then kill it. Do NOT run any destructive/mass commands. Do NOT modify live prod sqlite.

## Constraints
- Do not hand-edit source except through the coding agent run.
- Keep prod (default sqlite) healthy — pg path is isolated and not the active prod engine.
- Preserve existing behavior; minimal, no drive-by refactors.
