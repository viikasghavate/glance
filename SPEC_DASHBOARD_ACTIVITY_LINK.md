# Glance — Dashboard Recent Activity: "View all" link + task deep-link

## Objective
The Dashboard "Recent Activity" panel (`frontend/src/pages/DashboardPage.jsx`) shows the
latest 10 activity rows, but rows are plain `<div>`s (not clickable) and there is no way to
reach the full `/activity` log from the panel. Improve it:
1. Add a **"View all →"** link in the Recent Activity panel header that navigates to `/activity`.
2. Make activity rows whose `entity_type === 'task'` deep-link to the task:
   `/project/<project_id>?task=<task_id>`, reusing the existing `?task=` mechanism
   (`ProjectDetailPage.jsx` already auto-opens the task detail modal from that param).

## Assumptions / current state (verified in repo)
- Backend `GET /api/activity` (`backend/routes/activity.js`) returns rows:
  `{ id, user_id, action, entity_type, entity_id, entity_name, details, created_at, user_name }`,
  newest first. It already LEFT JOINs `tasks t ON a.entity_type='task' AND a.entity_id=t.id`
  but does NOT currently return `t.project_id` in the row.
- `frontend/src/pages/DashboardPage.jsx` already imports `Link` from `react-router-dom` and
  has `formatActivity(a)`, `relativeTime(a.created_at)`, `ACTION_LABELS`.
- The Recent Activity panel renders each row as
  `<div key={a.id} className="task-row activity-row">…</div>` (title + meta). Not clickable.
- `ActivityLogPage.jsx` already exists at route `/activity` (registered in App.jsx, icon-rail
  entry present). So the "View all" target already exists — just needs a link from the Dashboard.
- The `?task=<id>` deep-link mechanism is proven (Global Search, notifications, Copy Task Link).

## Scope — touch ONLY
- `backend/routes/activity.js` — include `project_id` in the response when the row is a task
  activity (`LEFT JOIN tasks` already present; add `t.project_id as project_id` to the SELECT).
  Read-only change, no schema.
- `frontend/src/pages/DashboardPage.jsx` — header link + clickable task rows.
- `frontend/src/pages/DashboardPage.css` — minimal styling for the header link / row link
  (only if truly needed; reuse existing `.task-row`, `.panel-title`, `.activity-row` styles first).

Do NOT touch ActivityLogPage, ProjectDetailPage, other components, db.js, or any other route.

## Behavior
### Backend (`backend/routes/activity.js`)
- Add `t.project_id as project_id` to the SELECT (inside the existing query). No other change.
- Non-task rows keep `project_id: null`.

### Frontend — Dashboard Recent Activity
- Panel header: render the `<h2 className="panel-title">Recent Activity</h2>` with a
  right-aligned `<Link to="/activity">View all →</Link>` (small, muted, hover-accented).
- Task rows (`a.entity_type === 'task' && a.project_id != null`): render as
  `<Link to={/project/${a.project_id}?task=${a.entity_id}} className="task-row activity-row">…</Link>`
  keeping the same title/meta children inside. Non-task rows stay non-clickable `<div>`s.
- Keep empty state ("No recent activity") unchanged.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. Backend boots; `GET /api/activity` rows for tasks now include `project_id` (non-task rows null).
3. Clicking a task activity row on the Dashboard navigates to `/project/<id>?task=<tid>` and the
   task detail modal opens (same as Global Search deep-link).
4. Clicking "View all →" navigates to `/activity`.
5. Non-task activity rows unchanged (still render, still not clickable); no regressions to the
   Dashboard or other panels.

## Constraints
- No schema/migration change; read-only backend addition.
- No new dependencies. No destructive operations.
- Reuse existing classes/helpers; keep the change small and readable.
- Implement via the coding agent; do not hand-edit source directly.
- Verify against a COPY of the live DB (activity_log rows with task + non-task entities).
