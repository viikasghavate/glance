# SPEC — My Tasks: Priority + Assignee Filters (parity with List/Kanban/Timeline)

## Objective
Add **Priority** and **Assignee** filter dropdowns to the My Tasks page
(`frontend/src/pages/MyTasksPage.jsx`) so users can narrow their assigned tasks by
priority and by assignee. This closes the last remaining filter gap: List, Kanban, and
Timeline views all have Priority and Assignee filters; My Tasks only has status chips +
search + sort + due filter. Frontend-only — no backend or schema change, no new deps.

## Current state (verified in repo, main branch)
- `GET /api/tasks/mine` (`backend/routes/tasks.js` route `router.get('/mine', ...)`) returns
  tasks with `t.*` (so each task carries `id, title, status, priority, due_date, assignee_id,
  labels, labelList, project_name, sprint_name, milestone_name, ...`).
- `frontend/src/pages/MyTasksPage.jsx` (239 lines) already has:
  - state: `filter` (''|todo|in_progress|done|overdue), `search`, `sortBy`, `sortDir`, `dueFilter`.
  - `filtered` useMemo (lines ~65-126) applying search → status/due → sort.
  - toolbar (`.my-tasks-toolbar`) with a search `<input>`, a sort `<select>`, a sort-direction
    button, and a due `<select>` (All Due / Overdue / Due Today / Due This Week).
  - Status chips row (`.my-tasks-chips`): All / To Do / In Progress / Done / Overdue.
  - `frontend/src/pages/MyTasksPage.css` defines `.my-tasks-toolbar`, `.my-tasks-search`,
    `select`, `.sort-toggle`, `.chip` etc. (check exact class names before editing).
- Reference pattern to copy for the filter selects: `frontend/src/components/TaskList.jsx`
  already renders Priority and Assignee `<select>` filters (see its `task-filters` toolbar).
  Mirror its option values/labels and its filter logic so behavior is consistent across views.

## Scope — touch ONLY
- `frontend/src/pages/MyTasksPage.jsx`
- `frontend/src/pages/MyTasksPage.css` (only if genuinely new classes are needed; reuse
  existing toolbar/select styling first)

Do NOT touch backend, db.js, other pages/components. No drive-by refactors. Keep existing
chips, search, sort, due filter, and deep-link rows intact.

## Behavior

### 1. Priority filter
- New state `priorityFilter` (default `''` = "All Priorities").
- Add a `<select>` in `.my-tasks-toolbar` (after the due filter select):
  - `<option value="">All Priorities</option>`
  - `<option value="high">High</option>`
  - `<option value="medium">Medium</option>`
  - `<option value="low">Low</option>`
- In the `filtered` useMemo, AND-in: if `priorityFilter` set, keep only `t.priority === priorityFilter`.

### 2. Assignee filter
- New state `assigneeFilter` (default `''` = "All Assignees").
- Add a `<select>` in `.my-tasks-toolbar` (after the priority select):
  - `<option value="">All Assignees</option>`
  - One option per distinct assignee present in the current `tasks`, keyed by `assignee_id`
    (e.g. `value={a.id}`). Label = assignee name (fall back to assignee_id/email if name empty).
    Build this list client-side from the current `tasks` set so it is always accurate; sort by name.
- In the `filtered` useMemo, AND-in: if `assigneeFilter` set, keep only
  `String(t.assignee_id) === String(assigneeFilter)`.

### Interaction
- All filters combine with AND: search, status chips, due, sort, priority, assignee.
- Reset options ("All …") restore the full set for that axis.

## Success criteria
1. My Tasks page shows Priority and Assignee dropdowns in the toolbar.
2. Selecting a priority shows only tasks of that priority; "All Priorities" restores all.
3. Selecting an assignee shows only tasks assigned to that user; "All Assignees" restores all.
4. Filters combine correctly with existing search/status/due/sort (AND logic).
5. `cd frontend && npm run build` passes with no errors.
6. Works against a copy of the LIVE DB (no schema/migration change; /mine payload unchanged).

## Constraints
- Route ALL code changes through the OpenCode agent (never hand-edit source yourself).
- Do not modify `backend/`. Pure frontend.
- Keep changes minimal and consistent with existing React/JSX style in MyTasksPage.jsx.
- Do not run destructive commands.
