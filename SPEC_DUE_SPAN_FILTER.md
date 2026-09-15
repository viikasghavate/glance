# SPEC — Task Due-Span Quick Filter (List + Kanban)

## Objective
Add a **due-date visibility quick filter** to the List view (`frontend/src/components/TaskList.jsx`) and the Kanban Board (`frontend/src/components/KanbanBoard.jsx`) so a user can quickly show **Overdue / Due Today / Due This Week** tasks alongside the existing filters. Today the views let you filter by status, priority, assignee, label, sprint, milestone — but there is no way to see just the overdue or upcoming-due tasks (the overdue state is only a row highlight, not a filter).

This is **frontend-only**. No backend change, no DB schema/migration change. Pure client-side filtering, consistent with the existing filter selects in `TaskList.jsx` (`<div className="task-filters">`) and `KanbanBoard.jsx` (`<div className="kanban-filters">`).

## Background (verified in repo, main branch)
- `TaskList.jsx` filter state: `filterStatus, filterPriority, filterAssignee, filterLabel, filterSprint, filterMilestone` (state at top of component) + `matchesFilter(t)` (lines ~89-96). Render: filter `<select>`s inside `.task-filters` (~lines 176-232). Rows already apply `isOverdue(task.due_date, task.status)` class for highlight; imported `isOverdue` from `./overdue`.
- `KanbanBoard.jsx` filter state: `filterLabel, filterPriority, filterAssignee, filterSprint, filterMilestone` + `getTasks(col.key)` uses chained `.filter(...)` calls (~lines 52-57). Render: filter `<select>`s inside `.kanban-filters` (~lines 124-158). Columns also highlight overdue already.
- Task objects carry `due_date` (string `YYYY-MM-DD` or null/'').
- `isOverdue(due_date, status)` lives in `frontend/src/components/overdue.js` — reuse it, don't reimplement.
- No CSS variables need adding; reuse existing `.badge`, select styles.

## Scope — touch ONLY these two files
- `frontend/src/components/TaskList.jsx`
- `frontend/src/components/KanbanBoard.jsx`

Do NOT touch backend, db.js, server.js, other components/pages, package.json. No new dependencies. No drive-by refactors.

## Behavior
Add one **Due** dropdown to each view, placed as the last filter select (after Milestones), label option `All Due`. Options (in this order):
- `all` → "All Due"
- `overdue` → "Overdue"
- `today` → "Due Today"
- `week` → "Due This Week"

Filter matching (client-side, using the client's local date):
- `overdue`: `isOverdue(t.due_date, t.status)` is true.
- `today`: `t.due_date` is non-empty and equals today's local date string (`YYYY-MM-DD`).
- `week`: `t.due_date` is non-empty, not in the past, and is within the next 7 days (>= today, <= today + 6 days). Overdue does NOT count as "this week". "Due Today" is included in "week".
- `all` / empty: no due filter applied.

**List view** — add `filterDue` state + a branch in `matchesFilter(t)`:
```js
if (filterDue === 'overdue' && !isOverdue(t.due_date, t.status)) return false;
if (filterDue === 'today' && !isDueOnOrAfter(t.due_date, today)) ... // must be today exactly
if (filterDue === 'week' && !inDueWeek(t.due_date, today)) return false;
```
Use today's local date string for comparisons. Since `matchesFilter` is used by both node and descendant logic, a due-filtered parent whose children don't match but which itself doesn't match is dropped correctly by the existing `flattenTree` logic (it already keeps nodes that match or have matching descendants). When filtering by due, an overdue **parent** with a due **child** should still show per the established descendant-keep behavior — follow the existing `matchesFilter` convention exactly; do not add special-casing.

Add helper functions in each file (or import a tiny local helper) consistent with how `isOverdue` is reused:
```js
const todayStr = () => { const d = new Date(); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
const inDueWeek = (due, today) => { if (!due) return false; if (String(due) < today) return false; const end = new Date(today+'T00:00:00'); end.setDate(end.getDate()+6); const endStr = ...YYYY-MM-DD...; return String(due) <= endStr; };
```
`today` filter: `String(due) === todayStr()`.

**Kanban view** — add `filterDue` state + add to `getTasks(col.key)` chain:
```js
.filter(t => !filterDue || dueMatches(t, filterDue))
```
where `dueMatches` applies the same rules (overdue via `isOverdue`, today equal, week within next 7 days as above). Keep it in the same chain style as the existing filters so each column is filtered identically.

In both views, compute `todayStr()` once per render (or via useMemo) so it is consistent within a render.

## Success criteria
1. `TaskList.jsx` and `KanbanBoard.jsx` each gain a **Due** dropdown (`All Due / Overdue / Due Today / Due This Week`), with matching working correctly (overdue ≠ this week; due today counts in week).
2. Existing filters (status/priority/assignee/label/sprint/milestone/sort) continue to work and compose with the new Due filter.
3. `cd frontend && npm run build` passes with **no errors**.
4. No backend files changed; `git status` shows only the two frontend component files (plus this spec).
5. No regressions to row/card rendering (overdue highlight, subtask indent, badges all preserved).

## Constraints
- Frontend-only; do NOT edit anything under `backend/`.
- Do NOT push to GitHub or deploy — the coordinator handles commit/deploy.
- Preserve existing route/order/behavior. No new dependencies. No refactors beyond the two files.
- After implementing, run `cd frontend && npm run build` and fix any errors before declaring done.

## Verification
- `cd frontend && npm run build` passes with zero errors.
- Report the exact diff summary (files changed) and build output.
