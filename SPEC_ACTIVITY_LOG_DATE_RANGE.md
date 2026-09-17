# SPEC — Activity Log: Date Range Filter (From / To)

## Objective
Let users narrow the Activity Log to a date window. Today the page filters by
entity type, actor (`user_id`) and free-text `q` — but not by time. An auditor
asking "what happened last week?" must page through rows manually. Add `from`/`to`
date query params to the backend and two `<input type="date">` controls to the
Activity Log page, composing (AND) with all existing filters, and thread them
into the CSV export too.

## Assumptions (verified in main)
- `backend/routes/activity.js` is mounted at `/api/activity`; both `GET /` and
  `GET /export` already accept `entity_type`, `q`, `user_id`, `limit`.
- `activity_log.created_at` is a **TEXT** column on BOTH engines:
  - sqlite (`backend/db.js`): `TEXT DEFAULT (datetime('now'))` → `'YYYY-MM-DD HH:MM:SS'`
  - pg (`backend/pg/schema.sql`): `TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))` → same shape
  Therefore a **lexicographic string comparison** (`a.created_at >= ?`) is correct
  on both engines. Do NOT use `datetime()`/`DATE()`/`to_date()`/`::date` — they are
  engine-specific. Compare against string bounds `'<from> 00:00:00'` and
  `'<to> 23:59:59'` so both endpoints are inclusive.
- The pg adapter transpiles `?`→`$n`, so keep `?` placeholders.
- Frontend `frontend/src/pages/ActivityLogPage.jsx`: has `entityType`, `userId`,
  `query`, `debouncedQuery`, `limit` state; `load(type, reset)` builds a
  `URLSearchParams` with `limit`/`entity_type`/`q`/`user_id`; `handleExportCsv`
  builds the same params for `/api/activity/export` via raw `fetch` + Bearer token.
  The reset-detection `useEffect` compares `prevEntityRef`/`prevQueryRef`/`prevUserIdRef`
  to decide `reset` (full reload) vs append.
- CSS: `.activity-filter-select` (min-width 180px) and `.activity-filter-input`
  exist in `ActivityLogPage.css`. Date inputs can reuse `.activity-filter-select`.
- Existing app-wide date-input pattern is a bare `<input type="date" value={x} onChange={...} />`
  (see `ProjectModal.jsx`, `TaskModal.jsx`). Follow it; no date library, no new deps.

## Scope — touch ONLY
- `backend/routes/activity.js` — add `from`/`to` to `GET /` and `GET /export`.
- `frontend/src/pages/ActivityLogPage.jsx` — two date inputs + state + params + export.

Do NOT touch: `db.js`, `pg/client.js`, `server.js`, other routes/pages/components,
`package.json`, no schema/migration, no new dependency. Keep CSS changes to zero
(reuse `.activity-filter-select`); only add CSS if a date input is visibly mis-sized.

## Backend — `backend/routes/activity.js`
1. In BOTH `GET /` and `GET /export`, destructure `from, to` from `req.query`.
2. Validate each with a strict `/^\d{4}-\d{2}-\d{2}$/` test **and** a real-date check
   (`!Number.isNaN(Date.parse(v))`). On a present-but-invalid value return
   `res.status(400).json({ error: 'Invalid <from|to> date format (expected YYYY-MM-DD)' })`
   — same style as `projects.js`/`sprints.js` `isValidDate` guards.
3. When valid, push `a.created_at >= ?` with `` `${from} 00:00:00` `` and
   `a.created_at <= ?` with `` `${to} 23:59:59` `` (independent conditions — either
   bound may be supplied alone). Values must go through the existing `values.push(...)`
   array so placeholder order stays aligned with `conditions`.
4. No change to SELECT columns, JOINs, ORDER BY, the 200-row cap in `/`, or the
   5000-row cap in `/export`.

## Frontend — `frontend/src/pages/ActivityLogPage.jsx`
1. Add `const [fromDate, setFromDate] = useState('');` and `toDate` likewise.
2. In `load(...)`, `params.set('from', fromDate)` / `params.set('to', toDate)` when set.
3. Extend the reset-detection: add `prevFromRef`/`prevToRef` and include
   `fromDate`/`toDate` in the `reset` comparison and in the effect's dependency array
   (mirroring the existing `userId` handling exactly), so changing a date reloads
   from the top rather than appending.
4. Add `handleFromDateChange` / `handleToDateChange` that call `setLimit(PAGE_SIZE)`
   then set state — identical shape to `handleUserIdChange`.
5. Render two `<input type="date" className="activity-filter-select" ...>` inside
   `.activity-filters`, after the user `<select>` and before the Export button.
   Give each an adjacent `aria-label` (`From date` / `To date`) via `title` or
   `aria-label`. No visible text label required (toolbar stays one row, wraps on narrow widths).
6. `handleExportCsv`: append `from`/`to` to its `URLSearchParams` when set.

## Success criteria
1. `npm run build` passes in `frontend/`.
2. `GET /api/activity?from=YYYY-MM-DD` returns only rows at/after that day; `to=` only
   rows at/before that day; both together form an inclusive window; neither param =
   unchanged behaviour.
3. Existing filters still compose: e.g. `?entity_type=task&user_id=<n>&q=foo&from=…&to=…`
   returns the intersection; `limit` and pagination behaviour unchanged.
4. `GET /api/activity/export?from=…&to=…` returns a CSV containing only in-window rows
   (verify the row count against the equivalent list query).
5. Invalid input (`from=2026-13-45`, `to=abc`) → HTTP 400 with the error JSON; no 500.
6. The filter still works on **Postgres** (prod engine) — the comparison must be
   plain string `>=`/`<=` with no engine-specific function.

## Constraints
- Do NOT hand-edit files outside the two listed; implement via the coding agent.
- Never run destructive commands; test against a COPY of the live DB, never the live file.
- Keep prod healthy.
