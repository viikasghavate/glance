# SPEC — Task Sort Controls (Timeline/Gantt view)

## Objective
Add a **Sort by** control (+ asc/desc toggle) to the Timeline (Gantt) view so a user can sort timeline tasks by **Priority / Due Date / Status / Assignee / Title**. List (`TaskList.jsx`) and Kanban (`KanbanBoard.jsx`) already have this sort control (SPEC_KANBAN_SORT / SPEC_TASK_SORT); the Timeline view is the only task surface still missing it. Pure frontend — no backend, no DB/schema change.

## Background (verified in repo, main branch)
- `frontend/src/components/TimelineView.jsx` renders the Gantt chart. It receives `{ tasks, users, onTaskClick }`. Filter state at top: `filterLabel, filterPriority, filterAssignee, filterDue`, then `filteredTasks = tasks.filter(...)`.
- Tasks are grouped by first label (`labelMap['Ungrouped']` / `'No Dates'` group for tasks without dates), then within each group sorted by `start_date` ascending (lines ~142-150), then groups ordered (No Dates last, then Ungrouped last, else label alphabetic).
- Reusable sort helpers **already exist** in `TaskList.jsx` / `KanbanBoard.jsx`:
  - `sortCompare(a, b)` — branches on `sortBy` (`'priority' | 'due_date' | 'status' | 'assignee' | 'title'`), with `priorityIndex = { low:0, medium:1, high:2 }`, `statusIndex = { todo:0, in_progress:1, done:2 }`. due_date: nulls sort last; assignee/title use lowercase string compare; unknown priority/status map to index 0.
  - `sortedCompare(a, b)` — for `due_date` nulls always last regardless of direction; otherwise `const result = sortCompare(a,b); if (result !== 0) return sortDir === 'desc' ? -result : result;`.
  - UI: a `<select value={sortBy}>` with `Sort by: None/Priority/Due Date/Status/Assignee/Title` and an asc/desc toggle button.

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx` — add `sortBy`/`sortDir` state, the two helper fns (`sortCompare`, `sortedCompare`) copied from TaskList, apply sort inside the group sort, and render the Sort `<select>` + asc/desc toggle button in `.timeline-filters`.
- `frontend/src/components/TimelineView.css` — only minimal spacing if the extra select/toggle needs it (prefer reusing existing `.timeline-filters select` styles first; a `.sort-toggle` class may be needed).

Do NOT touch backend, db.js, server.js, other views/components/pages, package.json. No new dependencies. No drive-by refactors.

## Behavior
1. Add `const [sortBy, setSortBy] = useState('')` and `const [sortDir, setSortDir] = useState('asc')`.
2. Add `priorityIndex`, `statusIndex`, `sortCompare`, `sortedCompare` — copy the exact definitions from `TaskList.jsx` (lines ~36-83 in current main), since they are proven correct and match the app's sort semantics.
3. In the `useMemo` that builds `sortedGroups` (group sort), replace the hardcoded start_date sort with: if `sortBy === ''` keep the existing start_date sort (default), else sort each group's tasks with `sortedCompare`. Keep the group ORDER logic unchanged (No Dates last, then Ungrouped, then alphabetical by label) — sorting is within groups only, matching how List sorts within its tree roots and Kanban sorts within columns. Preserve relative order of equal keys (stable sort via `.sort` on the copy).
4. Render a new `<select value={sortBy}>` (options above) and an asc/desc toggle `<button>` (shows ↑ when asc, ↓ when desc) appended as the last controls in `.timeline-filters`, after the Due filter. Place the toggle button with `type="button"` and a `.sort-toggle` class; toggling flips `sortDir`.
5. Keep the existing filters (Label/Priority/Assignee/Due) unchanged. Sorting applies to the already-filtered `filteredTasks`.

## Success criteria
- Timeline view shows Sort by None/Priority/Due Date/Status/Assignee/Title + an asc/desc toggle, matching List/Kanban look.
- With a sort key chosen, tasks within each group (and only within groups) reorder by the key; group headers keep their order (No Dates/Ungrouped last).
- No sort key: identical rendering to current behavior (start_date sort in groups).
- Null due dates sort last in both directions; no task is lost, duplicated, or moved to a different group.
- `npm run build` in frontend/ passes; no regressions in labels/priority/assignee/due filters.
