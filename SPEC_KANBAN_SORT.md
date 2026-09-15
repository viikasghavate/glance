# SPEC — Kanban Board Sorting

## Goal
Let users sort the **Kanban Board** view by priority, due date, status, assignee, or title — ascending or descending — mirroring the sort already present in the List view (`SPEC_TASK_SORT`). Currently the Kanban view only has filters (label/priority/assignee/sprint/milestone/due); cards within each column render in backend `position` order.

## Scope
Frontend-only change to `frontend/src/components/KanbanBoard.jsx` (+ CSS in `KanbanBoard.css`). No DB schema change, no backend change. Do NOT touch the List view, Timeline view, or Task Detail modal (all already have their own behavior).

## Behavior
Add a "Sort by" `<select>` and an adjacent asc/desc toggle button to the `.kanban-filters` toolbar (matching List's controls exactly — same options, same semantics, same component styling).

Options:
- None (default — keep current `position` order)
- Priority
- Due Date
- Status
- Assignee
- Title

Toggle button: arrow `↑` / `↓`, disabled when no sort key selected. Default direction: ascending.

Sorting must be **stable** and apply at the **root level only** within each column:
1. Build the tree (as today), flatten with `flattenTree` (collapse logic unchanged), then filter to the column's status (as today).
2. Apply the sort to the resulting column array **only after filtering**.
3. Do NOT reorder subtasks relative to their parent, and do NOT flatten/reparent. Preserve nesting exactly as today. Since within a column the flattened array interleaves subtasks under their parents in tree order, a stable sort keyed on each task's own value keeps each parent's children grouped under it (equal keys keep existing order).

Sort semantics (identical to List's `sortCompare`/`sortedCompare` in `TaskList.jsx`):
- **Priority:** order low < medium < high (map to index). Unknown → lowest.
- **Due Date:** parse `YYYY-MM-DD` string; missing date sorts last regardless of direction sense (a task with no due date stays below tasks that have one in ascending, and below in descending too — i.e. nulls always last). Compare as ISO strings. NOTE: this must mirror List's `sortedCompare` special-case (nulls always last), not plain `sortCompare`.
- **Status:** todo < in_progress < done. Unknown → first. (In Kanban each column is already a single status, so this is a no-op within a column but should still be implemented for consistency.)
- **Assignee:** `assignee_name` lexicographic (case-insensitive). Empty/missing → empty string.
- **Title:** lexicographic (case-insensitive).
- **None:** keep current array order (no-op).

## Implementation notes
- Add `sortBy` state (`'' | 'priority' | 'due_date' | 'status' | 'assignee' | 'title'`) and `sortDir` state (`'asc' | 'desc'`).
- Add `priorityIndex` and `statusIndex` constants, plus a `sortCompare(a,b)` and `sortedCompare(a,b)` exactly mirroring `TaskList.jsx` (reuse the same due-date-nulls-last logic).
- In `getTasks(status)`, after the existing `.filter(...)` chain and BEFORE `.sort((a,b) => a.position - b.position)`, apply sorting: if `sortBy === ''` keep position sort; otherwise use `[...flat].sort(sortedCompare)` (stable — Array.prototype.sort is stable in modern V8). Keep drag-reorder / position-based drop semantics UNCHANGED (the backend position field is unaffected; sorting is purely a display-layer ordering).
- Add the sort `<select>` + toggle button to `.kanban-filters` (after the Due filter, before the Collapse/Expand buttons) — mirror the List markup but keep the button's `className="sort-toggle"`.
- CSS: add `.sort-toggle` styles to `KanbanBoard.css` (copy the exact block from `TaskList.css`). `.kanban-filters` already wraps, so nothing else needed.

## Success criteria
- `npm run build` passes in `frontend/`.
- In a browser against the live backend: pick each sort option in the Kanban view, confirm cards reorder within their columns (roots stay grouped, subtasks stay under their parent), blank due dates sink to the bottom in both directions, priority order logical, asc/desc toggle reverses direction, and "None" restores the original position order.
- No console errors; drag-reorder still works (drop handlers unchanged).
- List, Timeline, Task Detail views unchanged.

## Constraints
- Do not create/alter any DB tables, indexes, or migrations.
- Do not change the backend API (task fetch/update/reorder endpoints untouched).
- Do not touch List, Timeline, or Task Detail views.
- Keep existing filters intact and functional.
