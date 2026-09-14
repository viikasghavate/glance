# SPEC — Task List Sorting

## Goal
Let users sort the **List view** task table by priority, due date, status, or assignee — ascending or descending. The list currently only renders in the backend `position` order.

## Scope
Frontend-only change to `frontend/src/components/TaskList.jsx` (+ CSS in `TaskList.css`). No DB schema change, no backend change.

## Behavior
Add a "Sort by" `<select>` next to the existing filters (All Statuses / All Priorities / All Assignees) with options:
- None (default — keep current order)
- Priority
- Due Date
- Status
- Assignee
- Title

Add an adjacent **asc/desc toggle button** (arrow ↑ / ↓) that toggles direction. Default direction: ascending.

Sorting must be **stable** relative to the original array order (so equal keys keep their existing order and subtask nesting isn't scrambled). Two requirements:
1. Sorting applies at the **root level only** — do NOT reorder children within a parent's subtree, and do NOT flatten/reparent. Build the tree first (as today), then sort the root array (and optionally each node's `.children` array) by the chosen key only when the node's key differs, keeping existing relative order otherwise.
2. Subtask display (indentation, collapse arrows, subtask counts) must remain identical to current behavior.

Sort semantics:
- **Priority:** order low < medium < high (map to index). Unknown → lowest.
- **Due Date:** parse `YYYY-MM-DD` string; missing date sorts last regardless of direction sense (a task with no due date stays below tasks that have one in ascending, and below in descending too — i.e. nulls always last). Compare as ISO strings.
- **Status:** todo < in_progress < done. Unknown → first.
- **Assignee:** `assignee_name` lexicographic (case-insensitive). Empty/missing → empty string.
- **Title:** lexicographic (case-insensitive).
- **None:** keep current array order (no-op).

## Implementation notes
- Add `sortBy` state (`'' | 'priority' | 'due_date' | 'status' | 'assignee' | 'title'`) and `sortDir` state (`'asc' | 'desc'`).
- Build `tree` (as today), then in the same `useMemo` apply sorted ordering to each level's array (roots and each node's `.children`) using a stable compare. Preserve the existing recursive `flattenTree` + `collapsed` collapse logic unchanged.
- Add the new controls to `.task-filters` (a `<select>` for sort key + a toggle button for direction).
- Update `task-table` header to show a small sort indicator? No — keep it minimal: the dropdown is the single source of control. Do not change header behavior.
- CSS: reuse existing `.task-filters select` styling; add `.sort-toggle` button style (ghost button, small).

## Success criteria
- `npm run build` passes in `frontend/`.
- In a browser against the live backend: pick each sort option, confirm rows reorder (roots only), subtasks stay under their parent, blank due dates sink to the bottom in both directions, priority/status order is logical, asc/desc toggle reverses direction, and "None" restores the original order.
- No console errors; drag-reorder still works (drop handlers unchanged).

## Constraints
- Do not create/alter any DB tables, indexes, or migrations.
- Do not change the backend API (task fetch/update/reorder endpoints untouched).
- Do not touch Kanban, Timeline, or Task Detail views.
- Keep existing filters intact and functional.
