# Glance — Sprint + Milestone Filters on Timeline (Gantt) view

## Objective
Add **Sprint** and **Milestone** filter dropdowns to the Timeline (Gantt) view so a
user can narrow tasks the same way they already can in the List and Kanban views.
Today the Timeline filter bar has Label / Priority / Assignee / Due filters plus sort
controls, but is missing Sprint and Milestone — a parity gap vs TaskList and
KanbanBoard which both expose them. Frontend-only; no backend, API, or DB changes.

## Assumptions (verified in repo)
- TimelineView receives `{ tasks, ... }` from the same `GET /tasks/project/:id` payload
  used by List/Kanban, which already includes `sprint_id`, `milestone_id`,
  `sprint_name`, `milestone_name` on every task (per SPEC_SPRINT_MILESTONE_FILTERS).
- `frontend/src/components/TimelineView.jsx` already has state:
  `filterLabel, filterPriority, filterAssignee, filterDue, sortBy, sortDir` and a
  `filteredTasks` memo (lines ~72-150) plus a `.timeline-filters` select bar (lines
  ~322+) and a `distinctLabels` useMemo for the label options.
- TaskList.jsx and KanbanBoard.jsx already implement the exact Sprint/Milestone
  filter pattern (two `<select>`s, options from distinct `sprint_name` /
  `milestone_name` filtering out empty, AND-composed with other filters).
- Neon theme: `.timeline-filters select` styling already exists; reuse it. No new
  dependencies.

## Scope — touch ONLY `frontend/src/components/TimelineView.jsx`
1. Add state: `filterSprint` (default `''`) and `filterMilestone` (default `''`).
2. Add useMemo sets for distinct sprint names and milestone names from `tasks`
   (filter out null/empty), mirroring TaskList/KanbanBoard.
3. In the `filteredTasks` memo, add:
   - `if (filterSprint && t.sprint_name !== filterSprint) return false;`
   - `if (filterMilestone && t.milestone_name !== filterMilestone) return false;`
   These compose (AND) with the existing label/priority/assignee/due filters.
4. In the `.timeline-filters` select bar, add **Sprint** and **Milestone** dropdowns
   alongside the existing selects: `All Sprints` / one option per distinct
   sprint_name, `All Milestones` / one option per distinct milestone_name. Place them
   after the Assignee (or Due) select; exact position is not critical — match the
   existing select styling/pattern.

### Out
- No changes to backend, db.js, server.js, TaskList, KanbanBoard, or TaskModal.
- No persistence of filters across reloads. No new dependencies.
- No destructive or DB-writing commands. No secrets.

## Success criteria (verifiable)
1. Timeline view shows a Sprint dropdown and a Milestone dropdown.
2. Selecting a sprint narrows the timeline bars/rows to tasks of that sprint only
   (composes with label/priority/assignee/due filters + sort).
3. Selecting a milestone narrows to that milestone only (AND-composed).
4. Tasks with no sprint/milestone still appear under "All" and are hidden when a
   specific sprint/milestone is selected.
5. `cd frontend && npm run build` exits 0 with no errors.
6. `git status` shows only TimelineView.jsx changed (plus this spec file).

## Constraints
- Touch ONLY `frontend/src/components/TimelineView.jsx`. Do not edit other files.
- Follow the existing function-component style and state patterns already in the file.
- Do NOT push to GitHub or deploy — coordinator handles commit/deploy.
- Preserve existing filter/sort/grouping behavior and ordering.

## Verification
- `cd frontend && npm run build` exits 0.
- (Coordinator) smoke test against a COPY of the live DB: open a project's Timeline
  view, pick each sprint and milestone, confirm bars/narrowing compose correctly.
