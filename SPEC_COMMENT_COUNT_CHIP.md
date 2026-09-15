# Spec: Comment Count Chip on Kanban Cards & List Rows

## Objective
Show how many comments a task has as a small chip on the **Kanban card** and the **List row**, so users can spot discussion activity at a glance. Today comments are only visible inside the Task Detail modal — the cards/rows have no clue about comment volume.

## Assumptions (verified in repo)
- Backend: Node/Express + better-sqlite3, ESM. `backend/routes/tasks.js`.
- `comments` table: `(id, task_id NOT NULL FK, user_id NOT NULL FK, body, created_at)`. Comments are hard-deleted (`DELETE FROM comments WHERE id = ?`), FK `ON DELETE CASCADE`. So a straight `COUNT(*)` over `comments WHERE task_id = t.id` is accurate (deleted rows are gone).
- Existing list endpoints that feed cards/rows:
  - `GET /project/:projectId` — builds `tasks` array via a big `SELECT ... FROM tasks t LEFT JOIN users...`, adds `subtask_count` via correlated subquery, then maps each row adding `...getDependencies(t.id)`, `labelList`, `checklist_progress[task.id]`. (line ~186-218)
  - `GET /mine` — same mapping shape. (line ~228-245)
- Frontend chips already rendered in the same place where the new chip will go:
  - `frontend/src/components/KanbanBoard.jsx` (~lines 240-250) renders `subtask_count` chip, `recurrence-badge`, `blocked-badge`, then `checklist_progress` chip (~286-289).
  - `frontend/src/components/TaskList.jsx` similarly (~310-321).
  - Chip CSS pattern in `KanbanBoard.css` (`.subtask-count`, `.checklist-chip`) and `TaskList.css` (same). Mirror these.

## Scope — touch ONLY
- `backend/routes/tasks.js` — add `comment_count` to the two list endpoints (`GET /project/:projectId` and `GET /mine`). No schema change.
- `frontend/src/components/KanbanBoard.jsx` + `KanbanBoard.css`
- `frontend/src/components/TaskList.jsx` + `TaskList.css`

Do NOT touch TaskDetailModal, other routes, or unrelated files. No drive-by refactors.

## Backend — `backend/routes/tasks.js`
Add `comment_count` to the task rows returned by both list endpoints.

Easiest, consistent approach: add a correlated subquery like the existing `subtask_count`:
```sql
(SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
```
in the `SELECT` of the `GET /project/:projectId` query **and** the `GET /mine` query (find each `subtask_count` SELECT and add the comment subquery right beside it).

Both endpoints already spread the full task row into each result (`tasks.map(t => ({ ...t, ... }))`), so `comment_count` will flow through automatically — no extra mapping needed.

## Frontend — cards & rows chip
Render a small comment chip **only when `task.comment_count > 0`**, in the same badge cluster as the existing `subtask-count` / `checklist-chip`:

- **Kanban card** (`KanbanBoard.jsx`, near the existing chip cluster ~line 240-250): add
  ```jsx
  {task.comment_count > 0 && (
    <span className="comment-count" title={`${task.comment_count} comment${task.comment_count === 1 ? '' : 's'}`}>💬 {task.comment_count}</span>
  )}
  ```
- **List row** (`TaskList.jsx`, same area ~line 310-321): add the identical JSX.

Match the existing chip wrapper structure exactly (the chips live inside the same parent span/div as `subtask-count`). Reuse the emoji `💬` (or a small inline SVG if the file already uses one for comments — check first; prefer consistency with the file's own style). Place it adjacent to / after the `subtask-count` and before or after `checklist-chip` — just keep it consistent between both files.

### CSS (both `.css` files)
Mirror the `.subtask-count` / `.checklist-chip` styling:
```css
.comment-count {
  /* same small chip look as .subtask-count / .checklist-chip — padding, border-radius, muted text, thin border */
}
```
Keep the Neon Cyberpunk theme (use the app's CSS variables `var(--...)` as the other chips do).

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. Backend boots; `GET /api/tasks/project/:projectId` returns `comment_count` per task (0 for tasks with no comments, correct count for tasks with comments).
3. `GET /api/tasks/mine` returns `comment_count` too.
4. A task with ≥1 comment shows the `💬 N` chip on its Kanban card and its List row; a task with 0 comments shows nothing.
5. All existing functionality preserved.

## Constraints
- Work only in `/home/ubuntu/projects/glance`. Do not hand-edit source — implement via the coding agent.
- No schema change, no data deletion, no destructive commands. Keep prod healthy.
- Match existing UI conventions and the Neon theme.
