# Glance — Sprint + Milestone Filters on Kanban & List views

## Objective
Add **Sprint** and **Milestone** filter dropdowns to both the Kanban Board and the
Task List view on the project detail page. Today cards/rows already display
`sprint_name`/`milestone_name` badges, but there is no way to filter tasks by sprint
or milestone. This closes the gap so a user can view just one sprint/milestone.

## Current state (verified)
- Task payloads (GET /api/projects/:id/tasks) already include `sprint_id`,
  `milestone_id`, `sprint_name`, `milestone_name` (via `SELECT t.*` + JOIN
  sprints/milestones in `backend/routes/tasks.js`).
- **KanbanBoard.jsx**: already has Label / Priority / Assignee filters. Cards render
  sprint + milestone badges.
- **TaskList.jsx**: already has Status / Priority / Assignee / Label filters + sort.
  Rows render sprint + milestone badges.

## Scope — touch ONLY these two files
- `frontend/src/components/KanbanBoard.jsx`
- `frontend/src/components/TaskList.jsx`

No backend, no DB, no other frontend files.

## Behavior
- Add a **Sprint** dropdown (All Sprints + one option per distinct `sprint_name`,
  excluding null/empty) to the filter bar in both views.
- Add a **Milestone** dropdown (All Milestones + one option per distinct
  `milestone_name`, excluding null/empty) to the filter bar in both views.
- Filtering: when a sprint is selected, show only tasks whose `sprint_name ===` the
  selection (or `sprint_id` match). Same for milestone. Filters compose with existing
  ones (AND).
- "No tasks match the filters." empty state already exists in both views — reuse it.

## Implementation notes
- Place the new selects alongside the existing filter selects, matching the current
  styling (`<select>` in `.kanban-filters` / `.task-filters`).
- Derive distinct sprint names and milestone names from `tasks` (filter out empty).
- Use name-based matching (`task.sprint_name === filterSprint`) for simplicity, since
  `sprint_name` is already present on every task payload and names are project-scoped.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. Kanban view shows a Sprint dropdown and a Milestone dropdown; selecting one filters
   the columns to matching tasks only (composition with label/priority/assignee works).
3. List view shows the same two dropdowns; selecting filters the list (composition
   with the existing filters + sort works).
4. Tasks with no sprint/milestone still appear when the "All" option is selected and
   are hidden when a specific sprint/milestone is chosen.
5. `git status` shows only the two spec-scope files changed (plus this spec file).

## Constraints
- Frontend-only. No backend/schema changes.
- Match existing UI conventions (badge colors, select styling, empty state).
- No drive-by refactors.
