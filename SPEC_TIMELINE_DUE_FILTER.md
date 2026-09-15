# SPEC — Task Due-Span Quick Filter (Timeline/Gantt view)

## Objective
Add a **due-date visibility quick filter** to the Timeline (Gantt) view so a user can
quickly show only **Overdue / Due Today / Due This Week** tasks. List (`TaskList.jsx`)
and Kanban (`KanbanBoard.jsx`) already have this due filter; the Timeline view is the
only task surface still missing it (it only has Label / Priority / Assignee filters).
This is a parity fix, pure frontend — no backend, no DB/schema change.

## Background (verified in repo, main branch)
- `frontend/src/components/TimelineView.jsx` renders the Gantt chart. It receives
  `{ tasks, users, onTaskClick }`. Filter state at top of component:
  `filterLabel, filterPriority, filterAssignee`, then a `filteredTasks = tasks.filter(...)`
  (lines ~56-75) that applies the three existing filters. Tasks carry `due_date`
  (string `YYYY-MM-DD` or null/'').
- Reusable helpers live in `frontend/src/components/overdue.js`:
  - `isOverdue(due_date, status, todayStr?)` → true when due date is before today AND status != 'done'.
- `TaskList.jsx` shows the exact pattern to mirror (the due filter was added there):
  - local `todayStr()` returns the local YYYY-MM-DD date string.
  - `inDueWeek(due, today)` returns true when due >= today AND due <= today+6 (not overdue).
  - `matchesFilter(t)` branches:
    - `filterDue === 'overdue'` → `if (filterDue === 'overdue' && !isOverdue(t.due_date, t.status)) return false;`
    - `filterDue === 'today'` → `(!(t.due_date && String(t.due_date) === todayStr()))` → false
    - `filterDue === 'week'` → `!inDueWeek(t.due_date, todayStr())` → false
  - A Due `<select>` is rendered as the last filter, label option "All Due", options
    `all / overdue / today / week` → "All Due / Overdue / Due Today / Due This Week".
- Kanban applies the identical logic in its `getTasks(col.key)` filter chain, with the
  same Due `<select>` in `.kanban-filters`.

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx`
- `frontend/src/components/TimelineView.css` (only if a narrow select needs spacing; reuse
  existing select styles first — likely no CSS change needed)

Do NOT touch backend, db.js, server.js, other views/components/pages, package.json.
No new dependencies. No drive-by refactors.

## Behavior
1. Add `filterDue` state (`'' | 'overdue' | 'today' | 'week'`).
2. Add the two small local helpers (`todayStr`, `inDueWeek`) — copy the exact definitions
   from `TaskList.jsx` so behavior is identical.
3. In the `filteredTasks` filter chain, append due clauses (same semantics as List/Kanban):
   - `overdue`: keep only tasks where `isOverdue(t.due_date, t.status)` is true.
   - `today`: keep only tasks where `t.due_date` is non-empty and equals today's local date.
   - `week`: keep only tasks where `t.due_date` is non-empty, not in the past, and within
     the next 7 days (>= today, <= today + 6). Overdue does NOT count as "this week".
     "Due Today" is included in "week".
   - `''` or `all`: no due filter applied.
4. Render a **Due** `<select>` as the last filter control in the Timeline filter row
   (after Assignee), label option "All Due", same option list/order as List/Kanban.
   Match the existing filter-select markup/classes already in `TimelineView.jsx`.
5. Keep existing Label / Priority / Assignee filters behavior unchanged (pure AND-combination).

## Success criteria
- `cd frontend && npm run build` passes clean (exit 0).
- Timeline view shows a Due dropdown: All Due / Overdue / Due Today / Due This Week.
- Selecting "Overdue" shows only tasks whose due date is past and not done.
- Selecting "Due Today" shows only tasks due today.
- Selecting "Due This Week" shows only tasks due today through +6 days (excluding overdue).
- Selecting "All Due" restores the full (label/priority/assignee-filtered) task set.
- No regression to Label/Priority/Assignee filters or the Gantt rendering/dates.

## Constraints
- Frontend-only. No backend/DB schema changes. No destructive commands.
- Reuse `isOverdue` from `./overdue`; reuse existing select styling. Do not refactor the
  Gantt date/group logic. Keep changes minimal and confined to the scope above.
