# SPEC — My Tasks: Search, Sort, and Due Quick Filter

## Objective
Add **search**, **sort**, and a **due quick filter (Today / This Week)** to the My Tasks page
(`frontend/src/pages/MyTasksPage.jsx`) so users can quickly find and order their assigned
tasks — parity with the List, Kanban, and Timeline views, which already have these controls.
My Tasks currently only has status chips (All / To Do / In Progress / Done / Overdue).

**Frontend-only.** No backend change, no DB schema/migration change. No new dependencies.

## Assumptions (verified in repo, main branch)
- Backend `GET /api/tasks/mine` (`backend/routes/tasks.js` route `router.get('/mine', ...)`) returns
  an array of task objects, each carrying: `id, title, description, status, priority, due_date,
  assignee_id, assignee_name, project_name, sprint_name, milestone_name, labels (string, comma-sep),
  labelList (array of {id,name}), subtask_count, comment_count, archived, start_date`.
- `frontend/src/components/overdue.js` exports helpers. Reuse them, do not reimplement:
  - `isOverdue(due_date, status, today)` — true when due in past and status !== 'done'
  - `dueInfo(due_date, status, today)` — used by other views for countdown chips (check its shape
    before reusing; if it isn't convenient here, compute Today/ThisWeek locally like TaskList/Kanban do)
  - `todayStr()` and `inDueWeek(due_date, todayStr)` — if present, reuse; otherwise TaskList.jsx
    has an equivalent inline `inDueWeek` used by its Due filter — mirror that logic.
- Existing `frontend/src/pages/MyTasksPage.css` defines chips (`.chip`, `.chip-todo`, `.chip-progress`,
  `.chip-done`, `.chip-overdue`, `.chip-count`), `.task-row`, `.task-row-title`, `.task-row-meta`,
  `.task-row-project`, `.task-row-assignee`, `.task-row-due`, `.badge`, `.panel`, `.page-header`,
  `.empty-state`, `.empty-hint`. Reuse these; add only new classes if truly needed.
- The page currently filters via `filter` state ('' | 'todo' | 'in_progress' | 'done' | 'overdue') and a
  `counts` useMemo of todo/in_progress/done/overdue. Tasks render as `<Link>` rows deep-linking to
  `/project/${task.project_id}?task=${task.id}`.

## Scope — touch ONLY
- `frontend/src/pages/MyTasksPage.jsx`
- `frontend/src/pages/MyTasksPage.css` (only if new classes are required)

Do NOT touch backend, db.js, server.js, other components/pages, package.json, overdue.js.
No drive-by refactors. Keep the existing chips and deep-link rows intact.

## Behavior

### 1. Search box
Add a search `<input>` (placeholder e.g. "Search your tasks…") in the `.page-header` row (or just
below it, above the chips). Client-side filter on a new `search` state:
- Match against title, description, project_name, and label names — case-insensitive, trimmed.
- Empty query → no filtering (show all).
- Combine with the existing status chip filter (AND) and the new due filter AND sort.

### 2. Sort control
Add a "Sort by" `<select>` with options (label → value):
- `None` / default → `''` (preserve the backend's existing order)
- `Priority` → `priority`
- `Due Date` → `due_date`
- `Status` → `status`
- `Title` → `title`

Plus an ascending/descending toggle button (▲/▼), new state `sortDir` (default asc).
Sort by the selected field; nulls sort last. Mirror the sort logic already in
`frontend/src/components/TaskList.jsx` (priority ranking high>medium>low, due_date chronologically,
status order todo/in_progress/done, title case-insensitive). When sort is `''`, ignore sortDir and keep
backend order.

### 3. Due quick filter
Add a "Due" `<select>` with options:
- `All Due` → `''`
- `Overdue` → `overdue`
- `Due Today` → `today`
- `Due This Week` → `week`

New state `dueFilter`. Filtering:
- `overdue` → `isOverdue(t.due_date, t.status, today)`
- `today` → due_date string equals today's date (YYYY-MM-DD)
- `week` → due_date within the current week (mirror TaskList `inDueWeek`/`dueMatches` logic)
- Combine AND with search, status chip, and sort.

### 4. Chip counts
Keep the existing counts (they reflect all tasks, not the filtered subset — unchanged behavior).
Do not recompute chip counts from the filtered list.

## Success criteria
- Build passes: `cd frontend && npm run build` succeeds; backend boots with no errors.
- Search narrows rows by title/description/project/label; clearing restores full list.
- Sort orders rows correctly in both directions; null due dates sort last; `''` preserves backend order.
- Due filter shows only Overdue / Today / This Week; combined with chips and search correctly.
- Existing status chips + deep-link rows + empty states still work (no regression).
- Verified against a COPY of the live DB (real tasks with varied due dates/labels) — no errors,
  no column/index errors.
