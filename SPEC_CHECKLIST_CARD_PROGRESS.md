# Spec: Checklist Progress on Task Cards & List Rows

## Objective
Show a task's checklist completion (e.g. `2/5`) as a small chip on the **Kanban card** and the **List row**, so users can see task progress without opening the detail modal. Today the backend already computes checklist progress for the *single* `GET /api/tasks/:id` response (`enrichTask` returns `checklist_progress: {total, completed}`), but the **project task list** (`GET /api/projects/:projectId/tasks` in `GET /project/:projectId`) and **`/mine`** responses do NOT include it — so cards/rows have no data to show. This closes that gap.

## Assumptions
- Backend: Node/Express + better-sqlite3, ESM. `backend/routes/tasks.js`.
- `task_checklist` table exists with `(id, task_id, text, completed, position)`. `completed` is 0/1.
- Existing helper pattern in `backend/routes/tasks.js`:
  - `enrichTask(id)` (line ~90) builds `{ ...task, ...deps, labelList, watchers, checklist_progress: { total, completed } }` using a `SELECT COUNT(*) as total, COALESCE(SUM(completed),0) as completed FROM task_checklist WHERE task_id = ?`.
  - `GET /project/:projectId` maps each row: `tasks.map(t => ({ ...t, ...getDependencies(t.id), labelList: getTaskLabels(t.id) }))`.
  - `GET /mine` maps similarly.
- Frontend: React/Vite. `frontend/src/components/KanbanBoard.jsx` (card meta area), `frontend/src/components/TaskList.jsx` (row, labels cell area), plus their `.css`.
- Existing UI shows a small `subtask-count` chip (`{task.subtask_count}`) and a `recurrence-badge`; reuse the same visual chip pattern for checklist progress.

## Scope
### Backend (backend/routes/tasks.js)
- Include `checklist_progress` in the **`GET /project/:projectId`** and **`GET /mine`** responses.
- Efficient approach: compute checklist progress with ONE aggregate query across all returned task ids (e.g. `SELECT task_id, COUNT(*) total, COALESCE(SUM(completed),0) completed FROM task_checklist WHERE task_id IN (...) GROUP BY task_id`), then attach a map to each task. (The current per-task `getDependencies`/`getTaskLabels` already do N queries; if you prefer to reuse `enrichTask`-style per-row computation for simplicity that is acceptable, but prefer the single grouped query to avoid N+1.)
- For a task with no checklist rows, `checklist_progress` should be `{ total: 0, completed: 0 }` (so frontend can simply omit the chip when `total === 0`).
- Do NOT change the `/project/:projectId` task ordering, filters, or other returned fields.
- Do NOT alter `enrichTask` or `GET /:id`.

### Frontend
- **KanbanBoard.jsx**: in the card meta row (next to `subtask-count`), render a chip showing `{completed}/{total}` when `task.checklist_progress && task.checklist_progress.total > 0`. E.g. `☑ 2/5`. When `completed === total`, style it as complete (green) rather than neutral.
- **TaskList.jsx**: in the row (labels cell or a new adjacent cell), render the same chip when `total > 0`.
- Add minimal CSS (`.checklist-chip`, `.checklist-chip.complete`) in `KanbanBoard.css` and `TaskList.css`, matching the existing chip styling (small, muted, uses `--cyan`/`--green` tokens). Keep the futuristic theme.

## Success criteria
- `GET /api/projects/:projectId/tasks` responses include `checklist_progress` for tasks that have checklist items, and `{total:0, completed:0}` for those without.
- `GET /api/tasks/mine` responses include `checklist_progress` likewise.
- A task with `2/5` checklist items shows a `2/5` chip on its Kanban card and its List row.
- A task with a fully-completed checklist (`5/5`) shows a green/complete chip.
- A task with no checklist shows no chip.
- `cd frontend && npm run build` succeeds; backend boots and serves `/health` OK.
- Tested against a COPY of the live DB (real tasks, some with checklist items) — list endpoints return rows with correct `checklist_progress` and no errors on real data.

## Constraints
- No schema/migration changes. Read-only addition (enrich existing GET responses + render). No destructive operations.
- Do not change task status/priority/labels/due_date rendering or drag-drop behaviour.
- Preserve existing task ordering, label filter, and all current fields returned by the list endpoints.
- No new npm dependencies. Do not hand-edit source directly — implement via the coding agent, then run build + tests yourself.
- Keep prod healthy; if a deploy breaks, revert.
