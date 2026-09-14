# Glance — Overdue Task Highlighting (Kanban + List Views)

## Objective
Visually flag **overdue** tasks (due_date in the past AND status not `done`) in the Kanban board and List view, matching the overdue treatment the Dashboard already has. This is a frontend-only UI improvement — no backend, no schema change.

## Current state
- Tasks have `due_date` (YYYY-MM-DD, nullable) and `status` (`todo|in_progress|done`).
- Dashboard (`frontend/src/pages/DashboardPage.jsx` + `.css`) already styles overdue rows via `.task-row.overdue`.
- Kanban (`frontend/src/components/KanbanBoard.jsx`/`.css`) shows `due_date` as `.due-date` but no overdue highlight.
- List view (`frontend/src/components/TaskList.jsx`/`.css`) shows `due_date` in `.date-cell` (or `'-'`) but no overdue highlight.

## Scope
1. **Kanban** — in `KanbanBoard.jsx`, compute `isOverdue = task.due_date && task.status !== 'done' && due_date < today`. Add class `overdue` to the task card when true, and a prominent red "⚠ Overdue" chip next to the due date. Add `.kanban-card.overdue` styles in `KanbanBoard.css` (red-tinted border/left accent, red `.due-date`).
2. **List view** — in `TaskList.jsx`, same `isOverdue` computation per task. Add `overdue` class to the row and a red due-date cell. Add `.task-row.overdue`-style rules in `TaskList.css` (row tint + red date).
3. **Shared helper** — add one small pure helper (e.g. in a new tiny module or inline duplicated) that takes `due_date`+`status` and today's date string and returns boolean. Keep it simple; use `new Date().toISOString().slice(0,10)` for "today".
4. Do NOT touch: TimelineView, TaskDetailModal, or backend.

## Success criteria
- Build passes: `cd frontend && npm run build`.
- A task with due_date < today and status != done shows red overdue styling in BOTH Kanban and List.
- A task with due_date >= today, or no due_date, or status === 'done' shows NO overdue styling.
- Existing layout/styles preserved otherwise.

## Constraints
- Work only in `/home/ubuntu/projects/glance`. Do NOT push to GitHub.
- Frontend-only: only `frontend/src/components/KanbanBoard.jsx`, `KanbanBoard.css`, `TaskList.jsx`, `TaskList.css` (and a small helper if truly needed).
- Preserve all existing functionality (drag-drop, filters, subtask nesting, collapsing).
