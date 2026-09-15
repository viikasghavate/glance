# Glance — Due-Date Countdown Chips on Timeline (Gantt) View

## Objective
Add the same **due-date countdown chip** to the Timeline/Gantt view that already exists on Kanban cards and List rows, so a task's due status (e.g. `5d left`, `due today`, `2d overdue`) is visible at a glance in the one task surface currently missing it. Pure frontend; no backend/DB changes.

## Current state / pattern to reuse (do NOT reinvent)
- `frontend/src/components/overdue.js` exports the exact helpers already used by Kanban (KanbanBoard.jsx) and List (TaskList.jsx):
  - `overdue.dueInfo(due_date, status, todayStr)` → `{ days, overdue, label } | null` (null when no due_date or status==='done'). Labels: `"due today"`, `` `${days}d overdue` ``, `` `${days}d left` ``.
  - `overdue.isOverdue(due_date, status, todayStr)` → boolean.
  Import from `'./overdue'` — same as the other two views.
- Chip markup pattern (from TaskList.jsx):
  ```jsx
  const info = dueInfo(task.due_date, task.status);
  const cls = info.overdue ? 'due-chip due-chip-overdue' : (info.days === 0 ? 'due-chip due-chip-today' : 'due-chip');
  <span className={cls}>{info.label}</span>
  ```
- Chip CSS already exists globally in `frontend/src/components/KanbanBoard.css` AND `frontend/src/components/TaskList.css` (`.due-chip`, `.due-chip-overdue`, `.due-chip-today`) — identical rules in both. Both are imported app-wide, so the classes are available; but add the same small rules to `TimelineView.css` too for self-containedness (same values as KanbanBoard.css lines ~122-140).

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx`
- `frontend/src/components/TimelineView.css`

Do NOT touch backend, db.js, overdue.js, KanbanBoard, TaskList, or any other file.

## Frontend — `TimelineView.jsx`
The task row meta block currently renders (in `.timeline-task-meta`): priority badge, status, assignee initials, recurrence badge (`↻`), blocked badge (`⛔`). Add the due chip in the **same meta block**, after the status/assignee and before or after the badges — placement consistent with the other views (right after the due-date info is fine; keep it small).

Concretely:
1. Add to imports: `import { dueInfo } from './overdue';` (only dueInfo is needed).
2. Inside the `group.tasks.map` task render, within the `.timeline-task-meta` span (near the existing status/assignee), render:
   ```jsx
   {dueInfo(task.due_date, task.status) && (() => {
     const info = dueInfo(task.due_date, task.status);
     const cls = info.overdue ? 'due-chip due-chip-overdue' : (info.days === 0 ? 'due-chip due-chip-today' : 'due-chip');
     return <span className={cls}>{info.label}</span>;
   })()}
   ```
   (Compute `dueInfo(...)` once into a const before the return if cleaner; the IIFE above is acceptable and matches TaskList's style.)

## Frontend — `TimelineView.css`
Add `.due-chip`, `.due-chip-overdue`, `.due-chip-today` rules matching KanbanBoard.css values (cyan/neutral chip; red for overdue; amber for today). Keep them minimal; the shared `var(--text-muted)`, `var(--bg-hover)`, `var(--border)`, `var(--danger)`, `var(--warning)` tokens are used.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean (no errors).
2. Timeline rows with a non-done due date show a chip: `X d left` (normal), `due today` (amber), `X d overdue` (red).
3. Tasks with no due_date, or status `done`, show NO chip.
4. Existing timeline behavior unchanged: grouping, today line, month/day header, weekend shading, status colors, recurrence/blocked badges, subtask indentation, click-to-open all still work.
5. No console errors in the Timeline view.

## Constraints
- Do NOT create/alter DB tables, indexes, or migrations. No backend changes.
- Do not change task data model or fetch ordering.
- Reuse `overdue.js` helpers exactly — do not re-implement date math.
- Do not hand-edit source directly here — implement via the coding agent. Keep changes minimal and readable.

## Verification
- `cd frontend && npm run build`.
- Optionally inspect built bundle / run dev server to confirm chips render without errors.
