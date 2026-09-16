# SPEC — Activity Log CSV Export

## Objective
Add a **CSV export** button to the Activity Log page (`/activity`) so admins/users can download the full audit trail into a spreadsheet. Mirrors the existing, proven CSV-export pattern already used for My Tasks (`GET /api/tasks/mine/export`) and per-project task export (`GET /api/projects/:id/export`). Closes the last remaining audit-trail gap — the activity view is currently view-only (no way to pull the data out).

## Current state (verified in repo, main branch)
- Backend `GET /api/activity` (`backend/routes/activity.js`) is `requireAuth`-protected and returns activity rows: `{ id, user_id, action, entity_type, entity_id, entity_name, details (JSON string|null), created_at, user_name, project_id }`, newest first. It accepts query params `entity_type`, `project_id`, `limit` (default 50, capped 200).
- `frontend/src/pages/ActivityLogPage.jsx` renders these rows with an entity-type filter dropdown, load-more (limit 50→200). It has NO export button.
- CSV pattern to mirror (both already shipped):
  - `backend/routes/tasks.js` `router.get('/mine/export', ...)` builds `headers + rows` arrays, joins each cell with a local `csvEscape()`, `\r\n` line endings, sets `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename=...`, `res.send(csv)`.
  - `backend/routes/projects.js` `:id/export` same pattern.
  - Frontend export handlers: `MyTasksPage.jsx` `handleExportCsv` does `apiFetch('/tasks/mine/export', ...)` (or fetch with auth), reads blob, creates object URL, clicks an `<a download>`, revokes. Reuse this exact client pattern.

## Scope — touch ONLY
- `backend/routes/activity.js` — add `GET /export`
- `frontend/src/pages/ActivityLogPage.jsx` — add Export CSV button
- `frontend/src/pages/ActivityLogPage.css` — only if a new class is needed (try to reuse `.btn-ghost`/existing filters layout first)

Do NOT touch db.js, server.js, other routes, other pages, package.json. No new dependencies.

## Backend — `GET /api/activity/export`
Add a `csvEscape` helper (copy the exact one from `tasks.js`/`projects.js`). Add route `router.get('/export', ...)` that:
- Reads the same `?entity_type=` and `?project_id=` filters as `GET /`, but does NOT apply the default `limit` cap to 200 — export the full matching set (remove the LIMIT, or use a generous cap like 5000 so a real export is complete). Keep `ORDER BY a.created_at DESC, a.id DESC`.
- Same JOINs as `GET /` (LEFT JOIN users → user_name, LEFT JOIN tasks → project_id for tasks).
- Build CSV with headers:
  `['id', 'time', 'user', 'action', 'entity_type', 'entity_name', 'details']`
  where:
  - `id` = a.id
  - `time` = a.created_at
  - `user` = a.user_name (or '' if null)
  - `action` = a.action
  - `entity_type` = a.entity_type
  - `entity_name` = a.entity_name
  - `details` = a.details (may be a JSON string — export raw; the spreadsheet keeps it)
- Every cell through `csvEscape`. `\r\n` lines. Set headers `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="activity-log.csv"`. `res.send(csv)`.
- The route is already under the file's `router.use(requireAuth)` — no auth change.
- Put `/export` BEFORE the `GET /` route definition order is fine either way since paths differ; but define it near `GET /` for clarity (order doesn't matter — different path). Keep it clean.

## Frontend — ActivityLogPage.jsx
- Add `const [exporting, setExporting] = useState(false);`
- Add `handleExportCsv` that mirrors `MyTasksPage.jsx` `handleExportCsv`:
  - Applies the CURRENT entity-type filter (pass `?entity_type=` if set, same as the list does) so "export what you see".
  - Requests `/activity/export${query}` with auth.
  - Reads response as blob, creates `URL.createObjectURL`, appends a temporary `<a download="activity-log.csv">`, clicks, removes, revokes, resets `exporting`.
  - On error: `console.error` + `alert('Export failed.')`.
- Add an "Export CSV" button in the `.activity-filters` row (next to the existing entity-type `<select>`), `className="btn-ghost"` to match the app, `disabled={exporting}` label `{exporting ? 'Exporting...' : 'Export CSV'}`.
- Keep the entity-type select and load-more behavior unchanged. Guard: if rows are empty, the button can stay enabled (export of 0 rows still yields a valid header-only CSV) — acceptable.

## Success criteria
- `cd frontend && npm run build` succeeds; backend boots with no errors.
- `GET /api/activity/export` returns a valid CSV (header row + data rows), respects `entity_type`/`project_id` filters, full set (not truncated to 200), escaped commas/quotes/newlines.
- Clicking Export CSV on the Activity Log page downloads `activity-log.csv` honoring the current entity filter.
- Existing activity list, filter dropdown, and load-more still work (no regression).
- Verified against a COPY of the live DB (real activity rows) — no errors, no column/index errors.
