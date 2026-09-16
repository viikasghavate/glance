# SPEC — My Tasks: Due-date countdown chips

## Objective
Add **due-date countdown chips** (`due today` / `Nd left` / `Nd overdue`) to each task row on the
My Tasks page (`frontend/src/pages/MyTasksPage.jsx`), matching the chips already shown in the
List view (`TaskList.jsx`), Kanban (`KanbanBoard.jsx`) and Timeline. Today My Tasks only shows
the bare due date (with a red `overdue` tint); it is the only task-list surface without countdown
chips. Frontend-only. No backend, no schema.

## Assumptions / current state (verified in repo, main branch)
- `frontend/src/components/overdue.js` exports `isOverdue(due_date, status, todayStr)` and
  `dueInfo(due_date, status, todayStr)`. `dueInfo` returns `{ days, overdue, label }` or `null`
  (null when no due_date or status === 'done'). Label is `due today` / `Nd left` / `Nd overdue`.
  **Reuse `dueInfo` — do not reimplement.**
- `MyTasksPage.jsx` already imports `isOverdue` and renders each row as:
  ```jsx
  <Link ... className={`task-row ${isOverdue(...) ? 'overdue' : ''}`}>
    <div className="task-row-title">{task.title}</div>
    <div className="task-row-meta">
      ...
      {task.due_date && (
        <span className={`task-row-due ${isOverdue(...) ? 'overdue' : ''}`}>
          {task.due_date}
        </span>
      )}
    </div>
  </Link>
  ```
- CSS chip classes already exist and are used by List (`TaskList.css`) and Kanban
  (`KanbanBoard.css`):
  - `.due-chip` (base pill), `.due-chip-overdue` (red), `.due-chip-today` (cyan/warn).
  Copy the same rule shapes into `MyTasksPage.css` so My Tasks looks consistent without
  depending on a component CSS file that may or may not be imported on this page.

## Scope — touch ONLY
- `frontend/src/pages/MyTasksPage.jsx`
- `frontend/src/pages/MyTasksPage.css`

Do NOT touch backend, db.js, server.js, overdue.js, TaskList, KanbanBoard, other pages/components.

## Behavior
1. Import `dueInfo` alongside the existing `isOverdue` import in `MyTasksPage.jsx`.
2. In the row's `.task-row-meta`, next to the existing due-date span, render a countdown chip for
   tasks that have a due date and are not done:
   ```jsx
   {task.due_date && (() => {
     const info = dueInfo(task.due_date, task.status, today);
     if (!info) return null;
     const cls = info.overdue ? 'due-chip due-chip-overdue'
                : info.days === 0 ? 'due-chip due-chip-today'
                : 'due-chip';
     return <span className={cls}>{info.label}</span>;
   })()}
   ```
   Use the page's existing `today` value (already computed and passed everywhere).
3. Keep the existing bare `task-row-due` date span and the `overdue` row tint exactly as-is.
   The chip is additive.
4. Add `.due-chip`, `.due-chip-overdue`, `.due-chip-today` rules to `MyTasksPage.css` (copy the
   shape from `TaskList.css` lines ~112-135: small rounded pill, muted border, tiny font; overdue
   red tinted; today cyan/amber tinted) so it renders consistently on this page.

## Success criteria
- Build passes: `cd frontend && npm run build` with no errors.
- My Tasks rows with a future due date show `Nd left`; today shows `due today`; overdue shows
  `Nd overdue` (red chip) — matching List/Kanban behavior. Done tasks show no chip.
- The existing bare date, overdue row tint, filters, search, sort, chips, and empty states all
  still work (no regression).
- Verified against a COPY of the live DB (real tasks with varied due dates) — no errors.
