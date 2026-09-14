# Spec: Export Project Tasks to CSV

## Objective
Add a small, clean feature: a "Export CSV" button on the Project Detail page that downloads the project's tasks (both board and list views share the same task set) as a CSV file.

## Assumptions
- Backend: Node/Express, better-sqlite3, ESM modules.
- Frontend: React/Vite SPA, auth via `apiFetch` from `AuthContext`.
- Tasks live in the `tasks` table (columns include `id, project_id, title, description, status, priority, due_date, assignee_id, labels, start_date, estimated_hours, time_spent, sprint_id, milestone_id`).
- Users in `users` (id, name, email); sprints/milestones tables exist.
- A `GET /api/tasks?project_id=` route already exists returning tasks (check its exact response shape before writing the export endpoint — reuse the same field names so CSV columns are consistent).
- No schema/migration changes. No destructive operations. Read-only feature.

## Scope
1. New backend endpoint: `GET /api/projects/:id/export` (or reuse tasks route) that returns the project's tasks as CSV (Content-Type `text/csv`) with a Content-Disposition attachment filename like `tasks-<projectId>.csv`.
2. Frontend: an "Export CSV" button in the Project Detail page header (next to "+ New Task"). Clicking it triggers a download of the CSV via `apiFetch` or a direct fetch with the auth token.

## Success Criteria
- Endpoint returns valid CSV with a header row and one row per non-deleted, non-archived task in the project.
- Columns: id, title, status, priority, assignee (name), labels, due_date, start_date, estimated_hours, time_spent (formatted), sprint (name), milestone (name), description (escaped for CSV).
- CSV values properly escaped (quotes doubled, fields containing commas/newlines quoted).
- Frontend button downloads the file; filename is `tasks-<projectId>.csv`.
- `npm run build` in frontend/ succeeds; backend boots without errors.
- Tested against a COPY of the live DB (the project has real tasks) — export returns rows and no errors on real data.

## Constraints
- Do not modify existing task/project APIs semantics.
- Keep it self-contained: no new npm dependencies beyond what's already installed (Node's built-in CSV handling is enough — no csv library required).
- Never run destructive commands.
