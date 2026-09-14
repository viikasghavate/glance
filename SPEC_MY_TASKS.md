# Glance — "My Tasks" Page (assigned-to-me across all projects)

## Objective
Add a dedicated **My Tasks** page (`/mytasks`) so a user can see every task assigned
to them across **all** projects in one list, with open tasks first and overdue
highlighted. Today there is no single view of a user's own assignments (the Dashboard
only shows a project-membership bar chart and an overdue widget). This closes that gap.

## Assumptions (verified in repo)
- Backend task table has `assignee_id INTEGER` (FK → users.id), `deleted_at`,
  `status` (`todo|in_progress|done`), `due_date`, `priority`, `labels`, `parent_id`,
  `sprint_id`, `milestone_id`. `idx_tasks_assignee_id` index already exists (db.js).
- `GET /api/tasks/project/:projectId` returns enriched rows:
  `t.*, assignee_name, reporter_name, sprint_name, milestone_name, subtask_count`,
  plus `labelList` and `getDependencies(...)`.
- `router.use(requireAuth)` is applied to all of `backend/routes/tasks.js`, so any
  new route on that router is auth-protected and `req.user.id` is available.
- `requireRole('admin','member')` only gates writes; reads are auth-only.
- Routes mount in `backend/server.js`: `app.use('/api/tasks', taskRoutes)`.
- Frontend pages live in `frontend/src/pages/`, routes in `frontend/src/App.jsx`
  (nested under `/` with `<Layout/>`), and nav is the icon rail in
  `frontend/src/components/Layout.jsx` (`.icon-rail` + `Icon<Name>` SVGs, `Link`s).
- Existing reusable classes: `.panel`, `.btn-ghost`, `.btn-sm`, `.badge`, `.task-row`,
  `.task-row-title`, `.task-row-meta`, `.task-row-assignee`, `.task-row-project`,
  `.task-row-due`, `.overdue`, CSS vars `--cyan --violet --bg --bg-card --border
  --text --text-muted --glow-*`. ProjectDetailPage/List style is the nearest analogue.
- `useAuth` context exposes the current user (`auth.user`, `auth.token`); pages use
  `apiFetch(path, opts)` which attaches the bearer token.

## Scope
- **Backend** — `backend/routes/tasks.js`: add
  `router.get('/mine', (req, res) => {...})` returning tasks where
  `assignee_id = req.user.id AND deleted_at IS NULL`, enriched exactly like the
  project listing (assignee/reporter/sprint/milestone names, `subtask_count`,
  `labelList`, `getDependencies`), ordered:
  incomplete first (`CASE WHEN status = 'done' THEN 1 ELSE 0 END`), then
  `due_date IS NULL` last, then due_date ASC, then priority, then title ASC.
- **Important:** register `router.get('/mine')` BEFORE any `/:id` param route so
  `/mine` is not captured as an id (put it near the existing `GET /project/:projectId`
  block). Do NOT shadow the existing order.
- **Frontend**:
  1. New `frontend/src/pages/MyTasksPage.jsx` (+ `MyTasksPage.css`):
     - Load `GET /api/tasks/mine` on mount.
     - Show count summary chips (Open / In Progress / Done / Overdue).
     - Render each task as a `.task-row` linking to `/project/{project_id}` —
       include an "open project" affordance. Optionally pass `?task=` deep-link so
       clicking the task title opens the detail modal (`?task=` deep-link pattern
       already supported by ProjectDetailPage from SPEC_SEARCH_TASK_DEEPLINK).
     - Group or tag rows by project name; show status badge, priority badge, due
       date, assignee name, sprint/milestone when present.
     - Overdue tasks (due_date < today && not done) get `.overdue` highlight.
     - Empty state "No tasks assigned to you."
     - Client-side filter dropdown: All / Open / In Progress / Done / Overdue.
  2. Register route in `frontend/src/App.jsx`:
     `<Route path="mytasks" element={<MyTasksPage />} />` under the `/` layout.
  3. Nav: add a **My Tasks** link in the icon rail (`Layout.jsx`) with a new
     `IconMyTasks` SVG, placed right after the Dashboard (home) button so it is
     prominent; highlight when `location.pathname === '/mytasks'`.
- Keep the Neon Cyberpunk theme; no new dependencies.

## Success criteria
1. `GET /api/tasks/mine` returns only the caller's tasks across all projects,
   incomplete-first, overdue-aware, enriched with names/labels/deps/sprint/milestone.
2. `/mytasks` page renders the list with working status filter and row links.
3. Icon-rail "My Tasks" button navigates to `/mytasks` and highlights when active.
4. Overdue tasks are visually highlighted.
5. `cd frontend && npm run build` passes with no errors; backend boots clean.

## Constraints
- Backend change limited to `backend/routes/tasks.js` (add `GET /mine`); do NOT edit
  `backend/db.js` or `backend/server.js`.
- Do NOT push to GitHub or deploy — the coordinator handles commit/deploy.
- Preserve existing functionality and ordering of existing routes.
- After implementing, run `cd frontend && npm run build` and fix any errors.

## Verification
- Backend boots; `GET /api/tasks/mine` returns correct subset with an auth token.
- Frontend build passes.
- (Coordinator) smoke test against a COPY of the live DB.
