# SPEC — My Tasks: Export to CSV

## Objective
Add an "Export CSV" button to the My Tasks page (`frontend/src/pages/MyTasksPage.jsx`) so users can
download their assigned tasks (as currently filtered/sorted on screen) as a CSV file. Mirrors the
existing project-tasks CSV export exactly.

## Assumptions (verified in repo, main branch)
- Backend already has a working CSV export pattern in `backend/routes/projects.js`:
  `csvEscape(value)` (quotes values, doubles inner quotes), `getTaskLabels(taskId).join('; ')`,
  header row + data rows, `Content-Type: text/csv; charset=utf-8`,
  `Content-Disposition: attachment; filename="..."`.
- `GET /api/tasks/mine` (`backend/routes/tasks.js` route `/mine`) returns an array with each task
  carrying: `id, title, description, status, priority, due_date, assignee_name, project_name,
  sprint_name, milestone_name, labels (string, comma-sep), labelList (array of {id,name}),
  start_date, estimated_hours, time_spent, comment_count, subtask_count, archived`.
- `MyTasksPage.jsx` already computes a `filtered` array (useMemo) honoring the status chips, search,
  due quick filter, priority/assignee/label/sprint/milestone filters AND sort. Reuse `filtered` so
  the export reflects exactly what the user sees.
- Frontend download pattern to copy: `ProjectDetailPage.jsx` `handleExportCsv` uses
  `localStorage.getItem('token')`, `fetch('/api/projects/'+id+'/export', {headers:{Authorization:
  Bearer token}})`, `res.blob()`, object URL, `<a download>` click. Reuse this verbatim for the new
  endpoint.

## Scope
### In
1. **Backend** `backend/routes/tasks.js` — add `GET /mine/export` (must be registered BEFORE any
   `/:id` or param route, or use an explicit path not shadowed; verify route order) that returns the
   current user's non-deleted assigned tasks as CSV, same column set/shape as the project export
   (reuse `csvEscape` + `getTaskLabels`) but scoped to `WHERE t.assignee_id = ? AND t.deleted_at IS
   NULL`. Filename: `my-tasks.csv`. `requireAuth` (same as `/mine`).
2. **Frontend** `frontend/src/pages/MyTasksPage.jsx` — add an "Export CSV" button in the
   `.page-header` row (next to the "My Tasks" `<h1>`), calling a `handleExportCsv` that downloads
   `<token>`-authed `fetch('/api/tasks/mine/export')` as `my-tasks.csv`. Copy the ProjectDetailPage
   handler pattern.
3. **Frontend** `frontend/src/pages/MyTasksPage.css` — only minimal spacing for the new header
   button if needed (reuse existing `.btn-ghost` class / header flex styles first).

### Out
- Do NOT touch `backend/db.js`, other routes, `ProjectDetailPage.jsx`, other components/pages,
  package.json. No schema/migration changes. No new dependencies (Node built-in CSV only).
- Do NOT change the semantics of `/api/tasks/mine` or project export.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. `GET /api/tasks/mine/export` returns valid CSV (header + one row per assigned non-deleted task),
   values correctly escaped, `Content-Disposition: attachment; filename="my-tasks.csv"`.
3. My Tasks page shows an "Export CSV" button; clicking downloads `my-tasks.csv`.
4. Backend boots cleanly with no route-order conflicts (verify `/mine/export` is not swallowed by a
   param route like `/:id`).
5. Tested against a COPY of the live DB (real assigned tasks with varied labels/due dates) — CSV
   rows appear, no errors, no column/index errors on existing prod data.
6. No regression: `/api/tasks/mine` and the My Tasks page still work identically.

## Constraints
- Do NOT edit `backend/db.js`. No destructive/mass DB commands. No secrets in logs.
- Match existing CSV-export + download patterns exactly (this is a copy of the project export flow).
- Keep minimal; no drive-by refactors.

## Verification plan
- `node --check` the edited route file.
- Test against a COPY of the LIVE DB (including `.db-wal`/`.db-shm`): start backend on the copy,
  login as a user with assigned tasks, `curl /api/tasks/mine/export` → 200 CSV with rows;
  `/api/tasks/mine` still returns JSON.
- `cd frontend && npm run build`.
- Prod after deploy: `docker exec` running container, `/health` healthy, bundle contains the new
  export label, and `curl /api/tasks/mine/export` (with token) returns CSV.
