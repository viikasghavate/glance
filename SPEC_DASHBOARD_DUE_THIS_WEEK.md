# SPEC — Dashboard "Due This Week" Panel

## Objective
Add a **"Due This Week"** task list to the Dashboard so users can see, at a glance, tasks that are coming due in the next 7 days (not yet done, not yet overdue). The Dashboard already shows an **Overdue Tasks** panel and an Overdue stat card, but there is no forward-looking "coming due" signal. Every project view (List/Kanban/Timeline/My Tasks) already has a "Due This Week" client-side filter and the `dueInfo` helper already renders `Xd left` / `due today` countdown chips — this closes the Dashboard's last visibility gap.

## Background / current state (verified)
- Backend: `backend/routes/analytics.js`, mounted at `/api/analytics`, `router.use(requireAuth)`. It already computes `overdueList` (tasks with `status != 'done' AND due_date < date('now')`, joined with project_name + assignee_name, `ORDER BY t.due_date ASC`) and returns it as `overdueTasks`. No due-soon (upcoming) list exists anywhere.
- Frontend: `frontend/src/pages/DashboardPage.jsx` renders an **Overdue Tasks** panel (`.dashboard-grid-bottom`) that maps `data.overdueTasks` into `.task-row.overdue` links (`/project/${t.project_id}?task=${t.id}`). It also calls `apiFetch('/activity?limit=10')`.
- `frontend/src/components/overdue.js` exports `dueInfo(due_date, status, todayStr)` → `null` if no due_date or status==='done'; else `{ days, overdue, label }` where label is `Xd left`, `due today`, or `Xd overdue`. Reuse this — do not reimplement.
- `DashboardPage.css` has `.task-row`, `.task-row:hover`, `.task-row-title`, `.task-row-meta`, `.task-row-due` styles (used by the Overdue panel). Reuse these for the new panel.
- Tasks table columns include `id, title, status, due_date, project_id, assignee_id`; `projects` and `users` exist.

## Scope — touch ONLY
- `backend/routes/analytics.js` — add a due-soon list to the existing `/` response.
- `frontend/src/pages/DashboardPage.jsx` — add a **Due This Week** panel.
- `frontend/src/pages/DashboardPage.css` — only minimal additions if genuinely needed (reuse existing `.task-row` styles where possible; a small "days left" chip style is acceptable).

Do NOT touch: db.js, other routes, other components/pages, Layout, theme tokens.

## Backend — `backend/routes/analytics.js`
Add a `dueSoonList` query (place it near `overdueList`, same style) that returns tasks due within the next 7 days (inclusive of today) that are not done and **not already overdue**:

```sql
SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN users u ON t.assignee_id = u.id
WHERE t.archived = 0 AND t.deleted_at IS NULL
  AND t.status != 'done'
  AND t.due_date IS NOT NULL
  AND t.due_date >= date('now')
  AND t.due_date <= date('now', '+6 days')
ORDER BY t.due_date ASC
```

Return it in the response object as `dueSoonTasks` (sibling of `overdueTasks`). Keep everything else identical.

## Frontend — `DashboardPage.jsx`
1. Import `dueInfo` from `../components/overdue` (add near the other imports).
2. In the bottom grid, next to the **Overdue Tasks** panel, add a **Due This Week** panel (same `.panel` structure, title class `panel-title` — not the danger one). Map `data.dueSoonTasks`:
   - Empty → `<div className="empty">No tasks due this week</div>`.
   - Each task → `<Link to={`/project/${t.project_id}?task=${t.id}`} className="task-row">` with:
     - `.task-row-title` → `{t.title}`
     - `.task-row-meta` → project name + assignee (mirror however the Overdue panel renders meta — check the existing Overdue panel JSX and copy its meta layout exactly).
     - `.task-row-due` → the raw `t.due_date` AND, if `dueInfo(t.due_date, 'todo')` returns a label, a small countdown chip `{info.label}` (e.g. `3d left`, `due today`). Pass status as non-'done' placeholder ('todo') since these tasks are guaranteed not done; the helper only checks `status === 'done'`.
3. Wrap both bottom panels (existing + new) inside the existing `.dashboard-grid dashboard-grid-bottom` container so they sit side by side (if the grid already arranges children responsively, two panels will render fine — no CSS change needed).

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. `GET /api/analytics` returns a `dueSoonTasks` array: only non-archived, non-deleted, not-done tasks with `due_date` between today and today+6 (inclusive), joined with `project_name` and `assignee_name`, ordered by due date ASC. Overdue tasks are excluded.
3. Dashboard renders a "Due This Week" panel listing those tasks, each deep-linking to its task detail modal, with project/assignee meta and a countdown chip (`Xd left` / `due today`).
4. Empty state ("No tasks due this week") shows when none match.
5. No regression: existing stats, donuts, Overdue panel, Recent Activity, and Time Tracking all still render.

## Constraints
- Do NOT edit `backend/db.js`, `server.js`, or other routes. Do NOT edit `SPEC_DASHBOARD_DUE_THIS_WEEK.md`.
- No schema/migration changes. No destructive commands. No secrets.
- Match existing code style and Neon theme exactly (reuse `.task-row` styles; only add a tiny chip style if needed).
- Do NOT push to GitHub — the coordinator handles commit + deploy.

## Verification
- `cd frontend && npm run build` → exits 0.
- Backend boots cleanly (`node backend/server.js` or the project's normal start).
- Tested against a COPY of the live DB: `/api/analytics` returns `dueSoonTasks` rows and no errors.
