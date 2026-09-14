# Task: Implement "Export Project Tasks to CSV" for Glance

You are the coding agent for the Glance project-management app. Implement exactly this feature. It is small, self-contained, read-only.

## Repository
/home/ubuntu/projects/glance  (git branch main)
- Backend: Node/Express ESM + better-sqlite3, backend/routes/, backend/db.js (db at process.env.DB_PATH)
- Frontend: React/Vite in frontend/, pages in frontend/src/pages/
- Codebase conventions: ESM imports, express Router per resource, `requireAuth` middleware in backend/middleware/auth.js, `apiFetch` helper in frontend/src/context/AuthContext.jsx.

## Objective
Add a "Export CSV" button on the Project Detail page that downloads the project's tasks as a CSV file.

## Feature spec (authoritative)
1. **Backend endpoint**: `GET /api/projects/:id/export` in `backend/routes/projects.js` (behind `requireAuth`). Returns project tasks as CSV:
   - Header + one row per non-deleted, non-archived task in the project.
   - Columns (in order): id, title, status, priority, assignee (assignee_name), labels (labelList joined by "; "), sprint (sprint_name), milestone (milestone_name), start_date, due_date, estimated_hours, time_spent (as-is), description.
   - Content-Type: `text/csv; charset=utf-8`.
   - Content-Disposition: `attachment; filename="tasks-<projectId>.csv"`.
   - 404 with {error:'Project not found'} if project missing.
   - **CSV-escape every field**: wrap in double quotes, double any internal `"`, and always quote (simpler + safe). Handle nulls as empty string.

   Reference: the existing tasks list query in `backend/routes/tasks.js` (`GET /api/tasks/project/:projectId`) already returns rows with `assignee_name, sprint_name, milestone_name` and is enriched with `labelList` from `getTaskLabels(t.id)`. You can reuse the same query approach. For labels inside projects.js, check if a `labelList`/tags source exists; if labels for tasks are expensive, fall back to `t.labels` string column if present, else leave labels as task's `labels` field value. Keep it simple and robust on real data.

2. **Frontend button**: In `frontend/src/pages/ProjectDetailPage.jsx`, in the `.view-actions` div next to "+ New Task", add an "Export CSV" (btn-primary or btn-ghost) button. On click, download the CSV using a direct fetch (NOT apiFetch, which parses JSON):
   - Token: `localStorage.getItem('token')`.
   - `fetch('/api/projects/' + id + '/export', {...})` with Authorization Bearer header (no Content-Type needed).
   - Read blob, create object URL, trigger anchor download with filename `tasks-<id>.csv`, revoke URL after.
   - Handle failure with a console.error / simple alert. Do NOT break the page.

## Success criteria
- `GET /api/projects/:id/export` returns valid CSV (headers+rows), proper escaping, correct filename.
- Button appears on Project Detail and downloads a CSV.
- `cd frontend && npm run build` succeeds.
- Backend boots without syntax errors (`node --check` on the changed file).

## Constraints (Karpathy principles)
- Do not add new npm dependencies. Use Node built-ins.
- Do not alter existing API semantics or other routes.
- No schema/migration changes. Read-only.
- Do not run destructive commands. Do not modify the live DB.
- Only touch: backend/routes/projects.js, frontend/src/pages/ProjectDetailPage.jsx (and its CSS file if a style touch is needed for the button). Keep the diff minimal.

## Verify before finishing
- Run `node --check backend/routes/projects.js`.
- Run `cd frontend && npm run build`.
- If you have a test DB copy at /home/ubuntu/projects/glance/.db-test/glance-live.db with DB_PATH, you may boot the backend against it to smoke-test the export endpoint (read-only). Otherwise just verify syntax+build.

Report what you changed and the verification results.
