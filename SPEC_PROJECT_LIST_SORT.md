# SPEC — Project List: Sort Control

## Objective
Add a **Sort by** dropdown (+ ascending/descending toggle) to the Projects page
(`frontend/src/pages/ProjectListPage.jsx`) so users can order the project cards — parity with
the List, Kanban, Timeline, and My Tasks views, which all already have sort controls.
Project List currently only has search + a status filter.

**Frontend-only.** No backend change, no DB schema/migration change. No new dependencies.

## Assumptions (verified in repo, main branch)
- `frontend/src/pages/ProjectListPage.jsx` renders a `.project-grid` of `.project-card` items from
  a `filteredProjects` array (a `useMemo`-style filter — currently a plain `.filter(...)` inline).
  Each project object carries: `id, name, description, status, priority, owner_name, progress,
  due_date, start_date, tags, taskCounts {todo,in_progress,done}, archived`.
- The page already has `search` and `statusFilter` state; the filter produces `filteredProjects`.
- Existing CSS classes in `frontend/src/pages/ProjectListPage.css` cover the cards; add only new
  classes for the sort control if truly needed (mirror the toolbar styling used elsewhere, e.g.
  `my-tasks-toolbar` in MyTasksPage).
- Sorting conventions elsewhere (TaskList.jsx / MyTasksPage.jsx): nulls sort last, priority ranks
  high > medium > low, status uses the todo/in_progress/done ordering, strings compare
  case-insensitively, `''` preserves the original order.

## Scope — touch ONLY
- `frontend/src/pages/ProjectListPage.jsx`
- `frontend/src/pages/ProjectListPage.css` (only if new classes are required)

Do NOT touch backend, db.js, server.js, other pages/components, package.json, or context files.
No drive-by refactors. Keep search + status filter + all card content intact.

## Behavior

### 1. Sort dropdown
Add a "Sort by" `<select>` in the existing `.project-filters` row (next to the status filter), with
options (label → value):
- `Sort by: None` → `''` (preserve existing order)
- `Sort by: Name` → `name`
- `Sort by: Priority` → `priority`
- `Sort by: Status` → `status`
- `Sort by: Progress` → `progress`
- `Sort by: Due Date` → `due_date`
- `Sort by: Owner` → `owner`

New state: `sortBy` (default `''`).

### 2. Asc/desc toggle
Add an ascending/descending toggle button (▲ / ▼), new state `sortDir` (default `asc`). Disable it
when `sortBy === ''`. Toggling flips the direction.

### 3. Sort logic
Wrap the project filtering so that when `sortBy` is set, the filtered list is sorted in place:
- `name` / `owner` → case-insensitive string compare on `p.name` / `p.owner_name`.
- `priority` → rank high > medium > low (map `{ low: 0, medium: 1, high: 2 }`); null/unknown sort as low.
- `status` → rank active/on_hold/completed/archived in that order (`{ active: 0, on_hold: 1,
  completed: 2, archived: 3 }`); null/unknown first or last consistently.
- `progress` → numeric compare; null treated as 0 (or last).
- `due_date` → chronological string compare; nulls sort last.
- Apply `sortDir` (desc reverses the comparator). When `sortBy === ''`, ignore `sortDir` and keep
  the original (backend) order.

## Success criteria
- Build passes: `cd frontend && npm run build` succeeds; backend boots with no errors.
- Sort dropdown orders project cards correctly in both directions for each field; null fields sort
  last (for due_date/owner); `''` preserves original order.
- Search + status filter still work and combine correctly with sort (filter first, then sort).
- Existing project cards, archive/delete/edit actions, and empty states still work (no regression).
- Verified against a COPY of the live DB (real projects with varied status/priority/due dates) — no
  errors, no column/index errors.
