# Glance — Per-Project Open-Task Count Badge in Sidebar Project Nav

## Objective
Show a small count badge (number of *open* tasks) on each project item in the left sidebar
project navigation, so users can see workload/activity at a glance without opening a project.

## Background / current state
- `GET /api/projects` already returns `taskCounts: { todo, in_progress, done }` for every
  project (computed in `backend/routes/projects.js`). No backend change needed.
- The project sidebar nav is rendered in `frontend/src/components/Layout.jsx` in the
  `ProjectNavGroups` function (a `renderProject` helper renders each `<Link className="project-nav-item">`
  with a color dot + project name). It is called at ~line 422 with `filteredProjects`
  (already carries `taskCounts` since it's the API payload).
- Sidebar styles live in `frontend/src/components/Layout.css` (classes `project-nav-item`,
  `project-nav-name`, `project-nav-dot`, `project-nav-section-count`).

## Assumptions
- "Open tasks" = `todo` + `in_progress` (i.e. not `done`, not deleted — the API already
  excludes deleted). Do NOT count archived projects (they don't appear in the default list).
- Pure frontend change. No backend, no DB schema, no migration.
- Preserve the existing Neon Cyberpunk theme. Keep the badge subtle and readable.
- Do not regress the existing group/portfolio/program rendering (`ProjectNavGroups`).

## Scope — touch ONLY these
- `frontend/src/components/Layout.jsx` — modify ONLY `renderProject` inside `ProjectNavGroups`
  to render an open-task count badge (e.g. `<span className="project-nav-badge">` with the
  count) when `taskCounts` shows open tasks > 0. Keep the Link/dot/name intact.
- `frontend/src/components/Layout.css` — add styles for `.project-nav-badge` (small, muted,
  aligned right of the name, e.g. font-size ~0.7rem, subtle background chip using theme
  tokens like `var(--bg-hover)`, `var(--text-muted)`, `var(--border)`; no heavy glow).

Do NOT touch any other files. No drive-by refactors.

## Success criteria
1. Each project in the sidebar shows an open-task count badge (todo + in_progress) when > 0.
2. Projects with 0 open tasks show no badge (cleaner).
3. Badge value matches the tasks shown in the project's Kanban/List views.
4. The existing active-project highlight, project grouping, search filter, and New Project
   button all still work.
5. `cd frontend && npm run build` passes with no errors.
6. No regressions to the rest of the app.

## Constraints
- Do NOT edit backend files or `backend/db.js`. Do NOT run destructive or DB-writing commands.
- Follow the existing React/JSX style (function components, `useAuth`/`useUI`, plain `.css`).
- Keep changes minimal, readable, and confined to the two files above.
- Match the existing visual language (theme tokens, subtle chips like `--bg-hover` + `--text-muted`).

## Verification
- `cd frontend && npm run build` exits 0.
- Logic check: badge count = `(taskCounts.todo||0) + (taskCounts.in_progress||0)`; render only
  when that sum > 0.
- Confirm the serving bundle contains the new badge class string.
