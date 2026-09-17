# SPEC — My Tasks row title chips (subtask / comment / checklist / blocked) parity

## Objective
The List view (`TaskList.jsx`) and Kanban board (`KanbanBoard.jsx`) render a set of
compact status chips next to each task title: subtask count, comment count, recurrence,
blocked-by indicator and checklist progress. The **My Tasks** page (`MyTasksPage.jsx`)
renders none of them, even though its API already returns all the underlying data.
This closes that parity gap. Frontend-only, no backend change.

## Assumptions / current state (verified in repo)
- `backend/routes/tasks.js` `GET /tasks/mine` SELECT already returns:
  - `subtask_count` — `(SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND deleted_at IS NULL)`
  - `comment_count` — `(SELECT COUNT(*) FROM comments WHERE task_id = t.id)`
  - `t.*` (includes `recurrence`)
  and the route then merges `...await getDependencies(t.id)` (which yields `blockedBy`
  array of `{ id, status, ... }`) and `checklist_progress` (from
  `getChecklistProgressMap`, shape `{ completed, total }`) into every row.
  **So no backend change is required — the data is already on the wire.**
- `frontend/src/pages/MyTasksPage.jsx` renders each task as a `<Link className="task-row">`
  with `.task-row-title` (the title text) and `.task-row-meta` (badges + due chip).
- Existing chip markup to mirror, from `frontend/src/components/TaskList.jsx` (lines ~350-368):
  ```jsx
  {task.subtask_count > 0 && (<span className="subtask-count">{task.subtask_count}</span>)}
  {task.comment_count > 0 && (
    <span className="comment-count" title={`${task.comment_count} comment${task.comment_count === 1 ? '' : 's'}`}>💬 {task.comment_count}</span>
  )}
  {task.recurrence && task.recurrence !== 'none' && (
    <span className="recurrence-badge" title={`Recurring: ${task.recurrence}`}>↻</span>
  )}
  {task.blockedBy && task.blockedBy.some(d => d.status !== 'done') && (
    <span className="blocked-badge" title="Blocked by incomplete dependencies">⛔</span>
  )}
  {task.checklist_progress && task.checklist_progress.total > 0 && (
    <span className={`checklist-chip ${task.checklist_progress.completed === task.checklist_progress.total ? 'complete' : ''}`}>
      ☑ {task.checklist_progress.completed}/{task.checklist_progress.total}
    </span>
  )}
  ```
- The chip CSS lives in `frontend/src/components/TaskList.css` (`.subtask-count`,
  `.recurrence-badge`, `.blocked-badge`, `.checklist-chip`, `.checklist-chip.complete`,
  `.comment-count`). `MyTasksPage.jsx` imports only `./MyTasksPage.css`, so do **not**
  rely on cross-file CSS leaking.

## Scope — touch ONLY these two files
- `frontend/src/pages/MyTasksPage.jsx`
- `frontend/src/pages/MyTasksPage.css`

Do NOT touch any other file. No backend, no API, no DB, no other component.

## Frontend changes — `MyTasksPage.jsx`
- Inside `.task-row-title`, render the **same five chips in the same order** as
  `TaskList.jsx`, immediately after the title text, using the exact same class names and
  the exact same conditional guards/titles listed above.
  - `{task.title}` then subtask-count, then comment-count, then recurrence-badge,
    then blocked-badge, then checklist-chip.
  - Keep the title element structure otherwise identical (no markup restructuring).
- Do not change filtering, sorting, counts (`counts.*`), the chips filter row, the due
  chip, or any other behaviour. No drive-by refactors.

## Frontend changes — `MyTasksPage.css`
- Add a small self-contained block defining the chip styles **scoped to the page** so the
  page never depends on `TaskList.css` being loaded: use `.my-tasks-list` ancestor
  selectors, e.g.

  ```css
  .my-tasks-list .subtask-count { /* ... */ }
  .my-tasks-list .comment-count { /* ... */ }
  .my-tasks-list .recurrence-badge { /* ... */ }
  .my-tasks-list .blocked-badge { /* ... */ }
  .my-tasks-list .checklist-chip { /* ... */ }
  .my-tasks-list .checklist-chip.complete { /* ... */ }
  ```
- Copy the visual treatment from `TaskList.css` for those same classes (read that file and
  match colours, font-size, padding, border-radius, vertical-align, opacity). Reuse the
  existing CSS custom properties (`--cyan`, `--magenta`, `--border`, `--text-muted`,
  `--radius-*`, `--glow-*`) rather than hardcoding hex values where the source rule uses a
  variable.
- Keep the chips on one line with the title: ensure `.task-row-title` allows the chips to
  sit inline (`display: flex; align-items: center; gap: ...` or the same approach
  `TaskList.css` uses for its title cell) and that long titles still truncate/ellipsize as
  they do today. Do not break the existing `.task-row-title` appearance when no chips are
  present.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean (no warnings introduced by this change).
2. On `/my-tasks`, a task that has comments shows the `💬 N` chip; a task with checklist
   items shows `☑ c/t`; a task with subtasks shows the count chip; a task blocked by an
   incomplete dependency shows ⛔; a recurring task shows ↻.
3. A task with none of those shows only its title — no empty chips, no layout shift.
4. Existing My Tasks behaviour is unchanged: status chips (All/To Do/In Progress/Done/
   Overdue), every filter/sort, "Clear filters", CSV export, due-date chip, and the
   row click-through to `/project/<id>?task=<id>` all still work.
5. No console errors on the page.

## Constraints
- Frontend only. No schema/migration/route changes. No destructive commands.
- Match existing code style exactly (copy the TaskList.jsx markup verbatim).
- Do not add new dependencies.
