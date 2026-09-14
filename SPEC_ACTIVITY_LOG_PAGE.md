# Glance — Activity Log Page (full audit view)

## Objective
Add a dedicated **Activity Log** page (`/activity`) so users/admins can see the full
audit trail, not just the last 10 items shown in the Dashboard "Recent Activity" widget.
Pure frontend increment — the backend `/api/activity` endpoint already exists and is
complete (supports `entity_type`, `project_id`, `limit` filters).

## Assumptions (verified in repo)
- Backend `GET /api/activity` is mounted at `/api/activity` in `backend/server.js`
  (`app.use('/api/activity', activityRoutes)`), `requireAuth`-protected.
- It returns rows: `{ id, user_id, action, entity_type, entity_id, entity_name,
  details (JSON string|null), created_at, user_name }`, newest first.
- It accepts query params `entity_type`, `project_id`, and `limit` (default 50, capped 200).
- Actions logged include (from `backend/routes/*.js`): `task.created`, `task.updated`,
  `task.status_changed`, `task.assigned`, `task.deleted`, `task.dependency_added`,
  `task.dependency_removed`, `task.dependencies_cleared`, `task.duplicated`,
  `comment.added`, `comment.deleted`, `project.created`, `project.updated`,
  `project.deleted`, `project.skill_required`, `project.skill_requirement_removed`,
  `user.created`, `user.deleted`, `user.role_changed`, `user.login`, `user.registered`,
  `user.password_reset`, `user.password_changed_self`, `user.updated_self`,
  `user.skill_set`, `user.skill_removed`, `user.skill_endorsed`,
  `user.skill_endorsement_removed`, `skill.created`, `skill.updated`, `skill.deleted`,
  `milestone.created/updated/deleted`, `sprint.created/updated/deleted`,
  `portfolio.created/updated/deleted`, `program.created/updated/deleted`, `ai.chat`.
- The Dashboard (`frontend/src/pages/DashboardPage.jsx`) already has:
  - `formatActivity(a)` helper → `"User verb 'entity'"` using an `ACTION_LABELS` map,
  - `relativeTime(dateStr)` helper,
  - an `ACTION_LABELS` const mapping action → verb phrase.
- App routes live in `frontend/src/App.jsx` (nested under `/` with `<Layout/>`).
- Icon rail nav lives in `frontend/src/components/Layout.jsx` (`.icon-rail`), with
  `Icon<Name>` SVG components defined at the top of the file.
- Existing styling: CSS vars (`--bg`, `--bg-card`, `--border`, `--text`, `--text-muted`,
  `--cyan`, `--violet`, `--glow-*`), `.panel`, `.btn-ghost`, `.badge`, `.task-row` classes.

## Scope
- **Backend:** No changes. Only verify the endpoint is reachable.
- **Frontend:**
  1. New `frontend/src/pages/ActivityLogPage.jsx` (+ `ActivityLogPage.css`):
     - Load `GET /api/activity?limit=200` (or a larger cap) on mount.
     - **Filters:** an entity-type dropdown (All / Task / Comment / Project / User /
       Skill / Milestone / Sprint / Portfolio / Program / Auth) mapping to the
       `entity_type` filter, and optionally a user filter client-side. Apply refetch on change.
     - **List:** each row rendered with `formatActivity`-style text, `entity_type`
       badge, `user_name`, and `relativeTime(created_at)`. Show the `details` JSON
       (pretty) when present (e.g. old→new status) as secondary muted line.
     - Pagination or "load more" button (limit 50, fetch more). Keep simple: a
       "Load more" button appending the next 50.
     - Empty state "No activity yet".
  2. Register route: `frontend/src/App.jsx` — add
     `<Route path="activity" element={<ActivityLogPage />} />` under the `/` layout.
  3. Nav entry: add an "Activity" link in the icon rail (`frontend/src/components/Layout.jsx`)
     with a new `IconActivity` SVG, placed logically (e.g. after Skills).
  4. Reuse the existing `formatActivity`/`relativeTime`/`ACTION_LABELS` logic (duplicate
     or extract — duplication is fine to keep it self-contained; do not refactor Dashboard).

## Success criteria
1. `/activity` route renders the full activity log with rows beyond the Dashboard's 10.
2. Entity-type filter refetches and narrows the list correctly.
3. "Load more" fetches/appends more rows without duplicates.
4. Each row shows user, readable action text, entity name, relative time, and details JSON.
5. Icon-rail "Activity" button navigates to `/activity` and highlights when active.
6. `cd frontend && npm run build` passes with no errors; app boots clean.

## Constraints
- Frontend-only. Do NOT edit backend, do NOT edit `backend/db.js`.
- Do NOT push to GitHub or deploy — the coordinator handles commit/deploy.
- Keep the Neon Cyberpunk theme. No new dependencies.
- Do not refactor existing Dashboard/activity code beyond what's needed.
- After implementing, run `cd frontend && npm run build` and fix any errors.
- Report what you changed and any issues.

## Verification
- Frontend build passes.
- (Coordinator) smoke test new page against a COPY of the live DB.
