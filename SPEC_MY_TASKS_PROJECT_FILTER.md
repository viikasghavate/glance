# SPEC — My Tasks: Project Filter (parity with List/Kanban/Timeline)

## Objective
Add a **Project** filter dropdown to the My Tasks page (`/mytasks`) so users can narrow
their assigned workload to a single project. This closes the last grouping gap on My
Tasks: the page already has status chips, search, sort, due, priority, assignee, label,
sprint, and milestone filters — but there is no way to view just one project's tasks.
Every other task view surfaces project context; My Tasks is the only one without a
project filter.

## Current state (verified in repo, main branch)
- `GET /api/tasks/mine` (`backend/routes/tasks.js` route `router.get('/mine', ...)`)
  returns task objects carrying `t.*` plus `project_name` (LEFT JOIN projects) and
  `project_id` (from `t.project_id`). Verified in the route SQL. **No backend change needed.**
- `frontend/src/pages/MyTasksPage.jsx`:
  - filter state at the top of the component:
    `filter` (''|todo|in_progress|done|overdue), `search`, `sortBy`, `sortDir`,
    `dueFilter`, `priorityFilter`, `assigneeFilter`, `labelFilter`, `filterSprint`,
    `filterMilestone`.
  - a `filtered` useMemo (lines ~66-126) that applies, in order: search → status/due →
    sprint → milestone → (other) filters → sort.
  - a toolbar (`.page-header` + `.my-tasks-toolbar`) with a search `<input>`, a sort
    `<select>` + direction button, and `<select>`s for Due, Priority, Assignee, Label,
    Sprint, Milestone.
  - existing pattern for building distinct `<select>` options from the task list:
    `assigneeOptions` memo (grouped from `tasks`) and `distinctLabels` memo. Mirror
    these for projects.
- The app convention: filters compose with AND (all filters apply to the same list).
  Sub-task rows stay grouped with their parent; a project filter must NOT reparent or
  flatten the tree — it only narrows which rows appear (matching how the existing
  sprint/milestone filters behave in My Tasks).

## Scope — touch ONLY
- `frontend/src/pages/MyTasksPage.jsx`
- `frontend/src/pages/MyTasksPage.css` (only if a genuinely new control style is
  needed; reuse the existing toolbar `<select>` styling first — the Due/Priority/
  Assignee/Label/Sprint/Milestone selects are the exact style to copy)

Do NOT touch backend, db, routes, other components/pages, or the timeline/list/kanban.

## Implementation (Karpathy — minimal, consistent with existing patterns)
1. Add state next to the other filter states:
   `const [projectFilter, setProjectFilter] = useState('');`
2. Add it to the "any filter active" check (the `hasActiveFilters`/`filterActive`
   boolean used to show the Clear Filters button) so clearing works — mirror `filterSprint`.
3. Add a `distinctProjects` memo (same shape as `assigneeOptions`): group the current
   `tasks` by `t.project_id`, pick the first non-null `t.project_name`, sort
   alphabetically by name (case-insensitive). Omit projects with null/empty name.
4. In the `filtered` useMemo, add a project filter step (place it with the other
   per-task filters, e.g. next to the sprint/milestone filter):
   `if (projectFilter && t.project_id != null && String(t.project_id) !== projectFilter) return false;`
   (match on `project_id` — compare as strings so numeric ids work; tasks with no
   project are excluded when a specific project is selected). Add `projectFilter` to
   the useMemo dependency array.
5. If the page has a "Clear filters" button (verify — it appears when
   `hasActiveFilters` is true), extend its reset to also set `projectFilter('')` and
   include `projectFilter !== ''` in the active-filter condition.
6. Add the Project `<select>` to the toolbar in a sensible position — after the
   Sprint/Milestone selects (or immediately after the Assignee select if the toolbar
   ordering already puts grouping filters together). Options:
   `<option value="">All Projects</option>` + one `<option key={p.project_id} value={String(p.project_id)}>{p.project_name}</option>`
   per distinct project. Reuse the exact same `className` as the other toolbar selects.

## Success criteria
- My Tasks toolbar shows an "All Projects" dropdown listing every distinct project
  among the user's assigned tasks.
- Selecting a project filters the list to tasks in that project only.
- Selecting "All Projects" restores the full list.
- The project filter composes (AND) with status chips, search, sort, due, priority,
  assignee, label, sprint, and milestone filters — no regression to any existing filter.
- Sub-task rows remain nested under their parent; no reparenting or flattening.
- The Clear Filters control (if present) resets the project filter too.
- `cd /home/ubuntu/projects/glance/frontend && npm run build` passes with no errors.

## Constraints
- Frontend-only. Do NOT touch backend, db.js, server.js, other routes, or other
  components/pages. No new dependencies. No schema/migration changes.
- Preserve the existing Neon/Cyberpunk theme and all existing functionality.
