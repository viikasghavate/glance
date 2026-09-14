# Feature: Dashboard Time Tracking Widget (aggregate time insight)

## Objective
Surface time-tracking totals on the Dashboard so users see, at a glance, how much time is logged and where it goes. Today the app records time entries (per-task UI in the Task Detail modal, `GET /api/time` list, `tasks.time_spent` denormalized) and shows a Dashboard, but the Dashboard has **no time-tracking insight** — `/api/analytics` and `DashboardPage.jsx` contain zero time/spent/hour fields. This fills that gap.

## Assumptions
- Stack: Node/Express + better-sqlite3 backend (ESM), React/Vite frontend (function components, `.jsx` + plain `.css`).
- Time is recorded in the `time_entries` table (`minute` field holds duration minutes; `task_id` links to tasks; users via `user_id`). `GET /api/time` already returns recent entries with `user_name`, `task_title`, `project_id` joined.
- Dashboard already loads `/api/analytics` (single fetch) into `data` and renders stat cards via a `<StatCard>` / dashboard section pattern in `frontend/src/pages/DashboardPage.jsx` (+ `.css`).
- Per-task time UI already exists and is unchanged; this feature only adds aggregate insight + rendering.
- Match existing design tokens (`--cyan`, `--border`, `--radius-lg`, `--glow-*`, badge tones). Neon-dark theme with cyan/magenta accents.

## Scope
### In
Backend — extend `/api/analytics` (`backend/routes/analytics.js`) to include a `time` object:
- `totalHoursLogged` — SUM(minutes)/60 over all non-deleted-task time entries.
- `hoursThisWeek` — SUM over entries created within the last 7 days.
- `hoursThisMonth` — SUM over entries created within the last 30 days.
- `timeByProject` — per project: `{project_id, name, hours}` (SUM minutes/60 grouped by task's project), ordered desc, limit ~6.
- `timeByUser` — per user: `{user_id, name, hours}` (group by `user_id`, join users), ordered desc, top ~6.
Reuse the existing query style (db.prepare, LEFT JOIN users/tasks/projects). Round hours to 1 decimal. Do NOT touch other analytics fields. No schema/migration change.

Frontend — `frontend/src/pages/DashboardPage.jsx` (+ matching `DashboardPage.css`):
- A new Dashboard section "Time Tracking" (below the existing stat grid / charts) containing:
  - Stat chips for Total Hours, This Week, This Month (1-decimal hour values).
  - A "By Project" mini-bar or list (project name + hours + proportion), top 6.
  - A "By User" list (user name + hours), top 6.
- Render only what exists; if `data.time` is absent (e.g. older backend), render nothing (defensive) — but we deploy backend+frontend together so it will be present.
- Use existing components/CSS conventions; small, readable, no drive-by refactors.

### Out
- No changes to the per-task time UI, `/api/time`, `time_entries` table, or DB schema.
- No new dependencies, no new API endpoint (extends existing `/api/analytics`).
- No authentication changes (analytics route already requireAuth).

## Success Criteria
1. `GET /api/analytics` returns a `time` object with `totalHoursLogged`, `hoursThisWeek`, `hoursThisMonth`, `timeByProject`, `timeByUser` when time entries exist (0 / empty when none).
2. Dashboard renders the Time Tracking section with the three stat chips and the By Project / By User lists.
3. `npm run build` in `frontend/` exits 0; backend starts (node syntax check) with no errors.
4. Works against a COPY of the LIVE database (migration/column-safe): time entries + tasks + users join queries return correct aggregates, no crash on existing prod data whose `time_entries` may be sparse/empty.
5. No regressions to existing Dashboard cards/charts or any other page.

## Constraints
- Do **not** edit `backend/db.js`, `backend/routes/time_entries.js`, or the task-detail time UI.
- Do **not** run any destructive or mass DB commands.
- Keep changes minimal and consistent with existing code style.

## Verification
- Backend: run the analytics query path (via node script or curl against local dev) with seeded + live-copy DB; confirm aggregate numbers and shape.
- Frontend: `cd frontend && npm run build` exits 0.
- Prod: after deploy, `docker exec` the running container, hit `/health` (healthy), and confirm the new Time Tracking section renders (bundle includes the new code) and `/api/analytics` returns `time.*`.
