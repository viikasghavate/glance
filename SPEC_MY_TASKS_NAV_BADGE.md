# SPEC — My Tasks open-task-count badge in side nav

## Objective
Add a small **open-task count badge** next to the "My Tasks" item in the left sidebar
Modules nav, so users see their pending workload at a glance without opening the page.
Mirrors the existing notification-bell badge (`unreadCount`) already in the top bar.

**Frontend-only.** No backend change, no DB schema/migration change, no new dependencies.

## Assumptions (verified in repo, main branch)
- Left sidebar nav is rendered in `frontend/src/components/Layout.jsx`. `navApps` (line ~212)
  defines per-app modules; the "Projects" app has `{ label: 'My Tasks', to: '/mytasks' }`
  (line ~226). Each module renders via `renderModule(mod)` (line ~246) which draws a
  `.nav-module-dot` + `.project-nav-name`. The "My Tasks" item has **no count badge today**.
- The top-bar notification bell already shows a badge via `unreadCount` state (line 152),
  fetched from `apiFetch('/notifications/unread-count')` (line ~158) and rendered as
  `<span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>`.
  Reuse this exact visual pattern (CSS class `notif-badge` already exists in Layout.css ~line 602).
- Backend `GET /api/tasks/mine` (backend/routes/tasks.js line 228) already returns every
  task assigned to the current user, each carrying `status` (`todo` | `in_progress` | `done`)
  and `archived`. **Open tasks = `status !== 'done'`.** No backend change needed.
- `apiFetch` is available in Layout.jsx (already used for notifications/search).

## Scope — touch ONLY
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/Layout.css` (only if a new class is required — prefer reusing `notif-badge`)

Do NOT touch backend, db.js, other components/pages, package.json.

## Behavior
1. Add state `myTasksOpenCount` (default 0) and a `useEffect` that, once per mount,
   fetches `/api/tasks/mine` and sets the count to the number of tasks with
   `status !== 'done'` (ignore `archived` — archived tasks are not shown on the My Tasks
   page's default view; count only what the user actually sees as open work). Wrap in
   try/catch; on error leave count at 0 (badge just doesn't show). Use a mounted/active guard
   so setState after unmount is avoided (mirror the unreadCount effect pattern).
2. In `renderModule(mod)`, when `mod.to === '/mytasks'` and `myTasksOpenCount > 0`, render an
   extra `<span className="notif-badge my-tasks-badge">` right after the name showing
   `myTasksOpenCount > 99 ? '99+' : myTasksOpenCount`. Show it only when > 0 (cleaner).
3. Keep the dot + name + existing styling intact. No other module gets a badge.
4. The badge is informational only — no click behavior change.

## Success criteria
- `cd frontend && npm run build` passes with no errors.
- When the logged-in user has open (non-done) assigned tasks, "My Tasks" shows a count badge;
  when zero, no badge.
- Badge count matches the number of open rows shown on the My Tasks page.
- No regression to nav rendering, active highlight, or the notification bell badge.
- Verified against a COPY of the live DB (logged-in user with real assigned tasks across
  statuses) — no errors.

## Constraints
- Do NOT edit backend files. Do NOT run destructive/DB-writing commands.
- Follow existing React/JSX style (function component, `useAuth`/`useUI`, plain `.css`).
- Keep changes minimal and confined to the two files above.
