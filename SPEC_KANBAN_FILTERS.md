# Spec: Kanban Priority + Assignee Filters (parity with List view)

## Objective
Add **priority and assignee filters** to the Kanban Board so users can narrow cards the
same way they can in the List view. Today the List view (`TaskList.jsx`) exposes
status/priority/assignee/label filters plus sorting, but the Kanban view
(`KanbanBoard.jsx`) only has a single label filter. This closes that parity gap.
Frontend-only — no backend or DB changes.

## Assumptions (verified in repo)
- `frontend/src/components/KanbanBoard.jsx` already receives `{ tasks, users, onReorder,
  onTaskClick, onEditTask, readOnly }` (ProjectDetailPage passes `users={users}`).
- The board's current filter block (`<div className="kanban-filters">`) has ONE select:
  `filterLabel` (state `'@/''` → `''`), options built from `distinctLabels`.
- Column tasks are computed in `getTasks(colKey)` which filters by status + label:
  ```js
  .filter(t => t.status === status)
  .filter(t => !filterLabel || (t.labels ? ... : ...).includes(filterLabel.toLowerCase()))
  ```
- Cards already render `priorityClass(task.priority)` (→ `badge badge-<p>`) and
  `task.assignee_name`. Tasks carry `priority` (`low|medium|high`) and `assignee_id`.
- `users` is an array of `{ id, name, ... }` (same source TaskList uses for its
  assignee dropdown).
- Neon theme tokens: `.kanban-filters select` already styled; reuse it.

## Scope
### In — `frontend/src/components/KanbanBoard.jsx` only
1. Add state: `filterPriority` (default `''`) and `filterAssignee` (default `''`).
2. Extend `getTasks(colKey)` to also filter by priority and assignee (mirror the
   TaskList patterns):
   - priority: `!filterPriority || t.priority === filterPriority`
   - assignee: `!filterAssignee || String(t.assignee_id) === filterAssignee`
3. In the `.kanban-filters` block, add two selects:
   - **Priority**: All Priorities / Low / Medium / High.
   - **Assignee**: All Assignees / one option per user (`value={u.id}`), mirroring
     TaskList's assignee dropdown.
4. Keep the existing label select. Order of the three selects is not critical; keep
   label first, then priority, then assignee (or match List ordering — your choice).

### Out
- No backend, API, DB schema, or migration changes.
- No changes to TaskList/TaskModal/drag-drop. No new dependencies.
- No persistence of filters across reloads.

## Success criteria
1. Selecting a priority narrows Kanban cards to that priority (combined with any
   active label filter).
2. Selecting an assignee narrows cards to that user's tasks (combined with label +
   priority filters).
3. Column counts (`colTasks.length`) reflect the filtered set.
4. Viewer (`readOnly`) still sees the filters (filtering is read-only) and drag-drop
   remains disabled for viewers.
5. `cd frontend && npm run build` exits 0 with no errors.
6. No regressions to existing kanban rendering, drag-reorder, label filter, or the
   blocked/overdue/recurrence/subtask chips.

## Constraints
- Touch ONLY `frontend/src/components/KanbanBoard.jsx`. Do not edit other files,
  backend, `db.js`, or CSS unless strictly required (prefer no CSS change; the
   `.kanban-filters select` styling already fits).
- Follow the existing function-component style and state patterns in the file.
- No destructive or DB-writing commands. No secrets.

## Verification
- `cd frontend && npm run build` exits 0.
- (Coordinator) smoke test against a COPY of the live DB: open a project's Board view,
  pick each priority and assignee, confirm cards/counts narrow and combine correctly.
