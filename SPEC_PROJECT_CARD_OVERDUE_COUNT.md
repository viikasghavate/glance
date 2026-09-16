# SPEC — Overdue-task count on Project List cards

## Objective
Show an **overdue-task count** on each project card in the Project List page
(`frontend/src/pages/ProjectListPage.jsx`) so users can see which projects have
stale/past-due work at a glance, without opening each project. A small, self-contained
backend + frontend increment. No schema/migration change. No new dependencies.

## Current state (verified, main branch)
- `GET /api/projects` (`backend/routes/projects.js`, list route) returns each project
  with `taskCounts: { todo, in_progress, done }` computed by a `GROUP BY project_id, status`
  query over non-deleted tasks. It does NOT include an overdue count.
- `ProjectListPage.jsx` renders `.project-card-counts` with three `.count-item` spans
  (To Do / In Progress / Done) driven by `p.taskCounts?.todo|in_progress|done`.
- `ProjectListPage.css` defines `.count-dot`, `.count-dot.todo/.in_progress/.done`
  (glowing dots using `var(--cyan)/--warning/--success`). `.count-item` exists.
- Tasks have `due_date` (YYYY-MM-DD, nullable) and `status` (`todo|in_progress|done`).
  "Overdue" means `due_date IS NOT NULL AND due_date < date('now') AND status != 'done'`
  (the same condition the Dashboard uses).

## Scope — touch ONLY
Backend:
- `backend/routes/projects.js` — list route only. Add an `overdue` field to each project's
  `taskCounts` object (and initialize it to 0 in the create route's `taskCounts` default so
  the shape stays consistent). Keep `todo`/`in_progress`/`done` unchanged.

Frontend:
- `frontend/src/pages/ProjectListPage.jsx` — in `.project-card-counts`, add a 4th
  `.count-item` for Overdue, rendered ONLY when `p.taskCounts?.overdue > 0` (hide when 0 to
  avoid clutter). Use a red `count-dot overdue` + "Overdue" label with the count.
- `frontend/src/pages/ProjectListPage.css` — add `.count-dot.overdue` (red dot, glow using
  `var(--danger)`/`var(--glow-danger)`) and optional `.count-item.overdue` (danger-tinted
  text) styles. Reuse existing `.count-item` layout (keep it a tiny addition).

Do NOT touch: db.js, other routes, other pages/components, ProjectListPage sorting/search
logic, Layout, theme tokens, package.json.

## Backend
1. In the list route, after the existing per-status `counts` query builds `countMap`, run a
   second aggregate:
   ```sql
   SELECT project_id, COUNT(*) as overdue
   FROM tasks
   WHERE deleted_at IS NULL AND project_id IN (<same ids>)
     AND status != 'done' AND due_date IS NOT NULL AND due_date < date('now')
   GROUP BY project_id
   ```
   Merge into `countMap[c.project_id].overdue = c.overdue` for each row, so every project's
   `taskCounts` gains an `overdue` number (default 0 via `|| 0` when absent).
2. Ensure `countMap` default objects (`{ todo: 0, in_progress: 0, done: 0 }`) are extended to
   include `overdue: 0` wherever they're created (both list route and create route default),
   so the field is always present.
3. No validation/whitelist changes.

## Frontend
In `ProjectListPage.jsx` `.project-card-counts`, after the Done count-item, add:
```jsx
{p.taskCounts?.overdue > 0 && (
  <span className="count-item overdue">
    <span className="count-dot overdue" /> {p.taskCounts.overdue} Overdue
  </span>
)}
```
In `ProjectListPage.css`, add:
```css
.count-dot.overdue { background: var(--danger); box-shadow: var(--glow-danger); }
.count-item.overdue { color: var(--danger); }
```

## Success criteria
1. Backend boots (fresh DB AND a COPY of the live DB — no column/index errors).
2. `cd frontend && npm run build` passes; `node --check backend/routes/projects.js` passes.
3. `GET /api/projects` returns `taskCounts` including an `overdue` count that matches:
   tasks with `status != 'done'` and `due_date < today` in that project.
4. Project cards show the red Overdue count item ONLY when overdue > 0; 0-overdue projects
   show no Overdue item (To Do / In Progress / Done render as before — no regression).
5. No schema/migration change; nothing destructive.

## Constraints
- Work only in `/home/ubuntu/projects/glance`. Do NOT push to GitHub (caller commits/deploys).
- Do NOT edit `backend/db.js` (no schema change).
- Preserve all existing functionality and the neon theme.
- Report exactly what you changed and any issues.
