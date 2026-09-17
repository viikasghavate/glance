# SPEC — Time Log page (`/time`) with filters + CSV export

## Objective
Time entries are already recorded (per-task "Time Log" panel in `TaskDetailModal`, denormalized `tasks.time_spent`, Dashboard aggregate widgets). But there is **no way to browse logged time across the workspace** — no page, no list, no export. The only cross-task read in the frontend is nothing at all: `GET /api/time` is never called by the UI.

Add a **Time Log** page that lists logged time with the same filter/sort/export affordances the rest of the app has (My Tasks, Activity Log, Project List all have filters + CSV). This is the last big orphaned backend surface in the app.

## Assumptions / current state (verified)
- Backend: Node/Express ESM + better-sqlite3, routers in `backend/routes/`, mounted in `backend/server.js`. **Dual-engine gotcha:** `backend/db.js` supports sqlite *and* Postgres; write queries so they work on both (plain string comparisons for dates, no engine-specific funcs).
- `backend/routes/time_entries.js` already has `GET /api/time` (requireAuth) returning up to 500 entries:
  `SELECT e.*, u.name as user_name, t.title as task_title, t.project_id FROM time_entries e LEFT JOIN users u ON u.id = e.user_id JOIN tasks t ON t.id = e.task_id WHERE t.deleted_at IS NULL ORDER BY e.created_at DESC LIMIT 500`
  It is **unfiltered and not paginated** — extend it rather than inventing a new route.
- Entry columns: `id, task_id, user_id, minutes, note, started_at, ended_at, created_at`.
- Existing conventions to copy **exactly**:
  - Auth middleware: `requireAuth` from `backend/middleware/auth.js`.
  - Rate/validation + 400 responses: see `backend/routes/activity.js` (added `from`/`to` date params in commit `d0707ec`) — replicate that validation style (`YYYY-MM-DD` regex → 400 on invalid).
  - CSV export endpoint pattern: `GET /api/activity/export` (`backend/routes/activity.js`) and `GET /api/tasks/mine/export` (`backend/routes/tasks.js`) — CSV-escape every field, always quote, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="..."`, `\r\n` line endings if that is what they use.
  - Frontend page pattern: `frontend/src/pages/ActivityLogPage.jsx` + `ActivityLogPage.css` (filters, `anyFilter`, load(), CSV download via token fetch, empty state).
  - `apiFetch` from `useAuth()` in `frontend/src/context/AuthContext.jsx`.
  - Route registration in `frontend/src/App.jsx` + nav entry in the rail (`frontend/src/components/Layout.jsx`, `navApps` → a suitable group, e.g. Workspace).
- Neon-dark theme (cyan/magenta accents, `--bg`, `--border`, `--cyan`, page-scoped CSS) is the house style. Per-page CSS files, no global CSS edits.
- **Do not** break the existing `GET /api/time` shape: the response must stay an array of entries with at least the fields it returns today (any new fields are additive).

## Scope

### In — backend: `backend/routes/time_entries.js` (extend existing GET only)
`GET /api/time` gains optional query params, all composable with AND:
- `project_id` — integer; filter to tasks of that project.
- `user_id` — integer; filter to entries by that user.
- `from` / `to` — `YYYY-MM-DD`; validate with regex, **400** `{error:'Invalid date'}` on malformed input (same style as `/api/activity`). Bound on `e.created_at` using plain string comparison `'<from> 00:00:00'` / `'<to> 23:59:59'` (works identically on sqlite and Postgres).
- `min_minutes` — optional integer; entries with `minutes >= min_minutes`.
- All params remain **optional**; with none supplied the endpoint behaves as today (same 500-row cap, same ordering). Keep the existing `LIMIT 500`.

Also add `GET /api/time/export` (requireAuth) applying the **identical** filter set, returning CSV with header
`id,task,task_id,project_id,user,minutes,hours,note,created_at`
(one row per matching entry, same ordering); CSV-escape every field (always quote, double internal quotes, nulls → empty string). Set the headers as in the existing export routes; filename `time-entries.csv`. No `LIMIT` on the export beyond a sane safety cap (reuse 5000 max, matching the spirit of the other exports — check what `/api/activity/export` does and stay consistent).

### In — frontend: new page `frontend/src/pages/TimeLogPage.jsx` + `TimeLogPage.css`
- Route `time` in `App.jsx` under the protected Layout route; nav entry in `Layout.jsx`.
- Filter bar (mirroring ActivityLogPage/MyTasksPage):
  - **Project** select — "All Projects" default; options built from a project list (`GET /api/projects` — check the actual endpoint/props the other pages use and reuse it, do not invent one).
  - **User** select — "All Users" default; options from the users source the app already uses elsewhere (`useAuth()` users or `/api/users` — match existing pages).
  - **From** / **To** date inputs.
  - **Min minutes** number input (optional).
  - **Clear filters** button rendered only when `anyFilter` is true (same pattern as `SPEC_PROJECT_VIEW_CLEAR_FILTERS`).
- Summary line: total entries + total hours (1 decimal) for the current (filtered) result set.
- Table/list of entries: date (`created_at`), user, task title (+ project), minutes/hours formatted (`45 min`, `1.5 h` — reuse/keep the existing `formatMinutes` convention used by `TaskDetailModal`), note.
- Empty state: "No time logged yet."
- **Export CSV** button: downloads via the export endpoint using the project's established pattern for CSV download: `localStorage.getItem('token')` + `fetch` (NOT `apiFetch`, which parses JSON), blob → object URL → anchor → revoke. Forward the **current** filters. Match the button placement/styling used on ActivityLogPage.
- Read-only page: no create/edit/delete here. Logging time still happens in the task detail modal.

### Out
- No schema change, no migration, no new dependency.
- Do not modify `TaskDetailModal`, the per-task time UI, `backend/db.js`, `recomputeTimeSpent`, or the Dashboard time widgets.
- Do not change the semantics of `DELETE /api/time/:id`.
- No changes to any other route or page.

## Success criteria
1. `GET /api/time` with no params returns the same array shape as before (no regression).
2. `GET /api/time?project_id=<id>`, `?user_id=<id>`, `?from=…&to=…`, `?min_minutes=…` each filter correctly and compose; malformed dates → 400.
3. `GET /api/time/export` returns valid, correctly escaped CSV honouring the same filters.
4. `/time` page renders, filters compose, Clear filters resets everything, Export CSV downloads a file whose rows match the on-screen filters.
5. `node --check` passes on every changed backend file; `cd frontend && npm run build` exits 0 with no new warnings introduced.
6. Works against a **copy of the live database** (including `-wal`/`-shm`): no missing-column or index errors, aggregates correct.
7. Prod stays healthy: `/health` returns ok after deploy; the new bundle contains the page.

## Constraints (Karpathy principles)
- Simplest thing that works; smallest diff; no drive-by refactors, no reformatting untouched code.
- Reuse the existing endpoints, helpers and CSS patterns instead of adding parallel machinery.
- Every new SQL statement must be sqlite + Postgres compatible.
- No destructive commands, no data mutation in this feature (read-only additions only).
- Never hand-edit generated/build output.
