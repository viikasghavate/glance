# SPEC: Task Label Filter (List + Kanban views)

## Objective
Add a client-side "Label" filter to the Task **List** view and the **Kanban** board
in the project detail page, so users can narrow tasks by a single label.
This is the one missing filter — Status, Priority, and Assignee filters already
exist in the List view; the Kanban view currently has no filters at all.

## Assumptions
- Labels are stored on each task as a comma-separated string in `task.labels`
  (e.g. `"bug, frontend, urgent"`), already rendered as `label-badge` chips in both views.
- The project detail page (`frontend/src/pages/ProjectDetailPage.jsx`) already passes
  the full `tasks` array down to `<KanbanBoard>` and `<TaskList>`.
- Existing List filters (status/priority/assignee) are client-side only — follow that
  pattern for the label filter (no new backend endpoint needed).
- The backend `GET /api/labels` exists but the UI does not use it; we do NOT need it —
  derive the distinct label list client-side from the current task set so it is always
  accurate and requires no extra network call.

## Scope (in-scope)
- **KanbanBoard.jsx**: add a `<select>` Label filter above/with the board columns.
  When set, only tasks whose `task.labels` contains the chosen label are shown in their
  columns (subtask visibility follows the task's own labels; apply filter at the flattened
  card level so subtasks are filtered independently, consistent with existing behavior).
  Provide "All Labels" option; reset to all when cleared.
- **TaskList.jsx**: add a `<select>` Label filter to the existing `task-filters` toolbar,
  next to Assignee. Filter `filtered` by label (match on comma-split trimmed labels).
- Both filters: dropdown lists distinct labels present across the current `tasks`,
  alphabetically sorted. Filter is "contains" match (a task is shown if any of its
  labels equals the selected one).
- CSS: minimal — reuse existing filter styling; add a small style class if needed.

## Out of scope
- No backend changes (no new endpoints, no DB migration).
- No changes to label creation/editing, task form, or label management.
- No changes to Timeline view (not requested; keep scope small).

## Success criteria
1. List view shows a Label dropdown; selecting a label shows only tasks bearing it;
   "All Labels" shows all tasks.
2. Kanban board shows a Label dropdown (top of board); selecting a label keeps only
   matching cards in their columns; "All Labels" restores all.
3. Filtering interacts correctly with existing status/priority/assignee filters (AND logic).
4. `npm run build` (frontend) succeeds with no errors.
5. App works against a COPY of the live DB (migrations intact, no schema changes).

## Constraints
- Never hand-edit source directly — route ALL code changes through the OpenCode agent.
- Do not modify `backend/` — this is a pure frontend feature.
- Keep changes minimal and consistent with existing React/JSX style in those components.
- Do not run destructive commands.
