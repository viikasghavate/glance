# SPEC — Duplicate Task (Clone a Task)

## Objective
Let any admin/member **duplicate (clone) a task** directly from the Task Detail modal. Copy the task's fields into a brand-new task in the same project with status reset to `todo` (so the copy does not inherit "done" or "in_progress" state) and `time_spent` reset to 0. Nothing about the original changes.

## Background / current state
- Stack: Node/Express + better-sqlite3 backend (ESM), React/Vite frontend, single Docker container.
- Task creation endpoint: `POST /api/projects/:projectId/tasks` in `backend/routes/tasks.js`. Accepts: `title, description, status, priority, due_date, assignee_id, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, sprint_id, milestone_id, start_time, end_time`. It validates each field (status/priority whitelist, date/time formats, sprint/milestone/parent belong to same project) and computes `position` automatically. `requireRole('admin','member')` on the whole router (route file has `router.use(requireAuth)` — create route uses `requireRole('admin','member')`).
- `GET /api/projects/:projectId/tasks` returns each task with `assignee_name`, `sprint_name`, `milestone_name`, `subtask_count`, `blockedBy`/`blocks` (deps), `labelList`, `watchers`, `checklist_progress` via `getTaskWithDeps(id)`.
- Task Detail modal: `frontend/src/components/TaskDetailModal.jsx`. Header row (`.task-detail-header`) has `<h2>{task.title}</h2>`, a Watch/Unwatch button (gated `!readOnly`), and a close `&times;` button. It receives `{ task, tasks, users, onClose, onUpdate, onDelete, apiFetch, readOnly }`.
- `readOnly === true` when viewer is a `viewer` role. App convention: every mutating action is gated by `!readOnly`.
- After creating a task the project view must refresh to show the new task (the parent page owns the fetch). The modal gets `onUpdate` (used for field edits) and `onClose`; the parent (`ProjectDetailPage.jsx`) reloads tasks from the API — verify how the parent refreshes so the duplicated task appears. Do NOT couple to parent internals beyond what's already passed.

## Scope — touch ONLY
Backend:
- `backend/routes/tasks.js` — add one new endpoint: `POST /api/tasks/:id/duplicate` (member/admin only).

Frontend:
- `frontend/src/components/TaskDetailModal.jsx` (+ `TaskDetailModal.css` if a button style is needed — prefer existing `btn-ghost btn-sm`).

Do NOT touch: db.js, other routes, ProjectDetailPage, other components, other pages.

## Backend — `POST /api/tasks/:id/duplicate`
1. `requireRole('admin','member')` on the route (like the existing create/update/delete routes).
2. Load source task by `:id` where `deleted_at IS NULL`; if missing → 404 `{ error: 'Task not found' }`.
3. Read the source row and INSERT a new task in the SAME project copying:
   - `title`, `description`, `priority`, `due_date`, `assignee_id`, `labels` (comma string), `start_date`, `estimated_hours`, `reporter_id`, `parent_id`, `recurrence`, `recurrence_end`, `sprint_id`, `milestone_id`, `start_time`, `end_time`
   - **Override:** `status = 'todo'`, `time_spent = 0`, `archived = 0`, `position` = next available in `todo` column (reuse the `MAX(position)+1` pattern from the create route).
   - **Do NOT copy:** `id`, `created_at`, `updated_at`, `watchers`, `checklist`, `attachments`, `time_entries`, `comments`, `task_status_history`, `task_dependencies`, recurrence-created future occurrences.
4. Best approach: reuse the EXISTING create logic. The cleanest minimal implementation: build the new task's field object from the source and call the same INSERT statement the create route uses (with the overrides above). If you refactor the INSERT into a shared helper, keep behavior identical. Do not duplicate validation that create already does — but you still need the same project_id guarantee (source task's project is used, so sprint/milestone/parent of the source already belong to that project by construction — no cross-project risk).
   - Note: if copying `sprint_id`/`milestone_id`, they could theoretically be from a sprint that belongs to a DIFFERENT project than the source task's current project if the task was moved. Guard: verify the source's `sprint_id`/`milestone_id`/`parent_id` still belong to `source.project_id` before copying; null them out if they don't (task may have been moved between projects).
5. After insert, call `getTaskWithDeps(newId)` to return the full new task (with name joins, labelList, etc.) — same shape as create returns. Status 201.
6. Log activity: `logActivity(req.user.id, 'task.duplicated', 'task', newId, newTask.title, { from: sourceId })` (match the `logActivity` signature used elsewhere — see how `task.created` is logged).
7. Do NOT copy checklist items, dependencies, watchers, comments, attachments, or time entries. Only the scalar fields listed above.

## Frontend — `TaskDetailModal.jsx`
1. Add a **Duplicate** button in the `.task-detail-header`, next to the Watch button, gated `!readOnly`. Style with existing `btn-ghost btn-sm`. Label: `⧉ Duplicate` or `Duplicate`.
2. `const handleDuplicate = async () => { ... }`:
   - `const data = await apiFetch('/tasks/' + task.id + '/duplicate', { method: 'POST' });`
   - On success: call `onUpdate(data)` if the modal uses `onUpdate` to refresh the current task, AND ensure the parent refreshes its task list so the new row appears. Check how other mutations in this modal notify the parent (e.g. `onDelete` closes; watch uses `onUpdate`). Use the SAME mechanism the modal already uses to tell the parent "data changed" — do not invent a new prop.
   - Keep the modal open showing the ORIGINAL task (do not switch the modal to the newly duplicated task). A brief inline success hint is nice-to-have but optional; do not add heavy UX. At minimum: no crash, new task appears in the board/list after the parent reloads.
   - Show an error message on failure (match existing error pattern in the modal, e.g. `alert()` is NOT the pattern — check how checklist/add-comment handle errors; use a small local error state if none exists, or console.error + keep quiet — follow the file's existing convention).
3. Guard: disabled or hidden entirely when `readOnly` is true (viewer never sees it).

## Success criteria
1. Backend boots with a FRESH DB and with a COPY of the LIVE DB (migrations run, no index/column errors).
2. `npm run build` in `frontend/` passes; backend syntax check passes (`node --check` on the edited route file, or `npm run` dev smoke).
3. `POST /api/tasks/:id/duplicate` with an admin token returns 201 + full new task; the new task has status `todo`, `time_spent` 0, same project, same title/description/priority/due_date/assignee/labels as the source; `created_at` differs; original task unchanged.
4. The board/list view shows the duplicated task after the action (parent refreshes).
5. Viewers (`readOnly`) see no Duplicate button and the route rejects them (403).

## Constraints
- Work only in `/home/ubuntu/projects/glance`. Do NOT push to GitHub yourself — the caller commits/deploys.
- Do NOT modify db.js (no schema change).
- Do NOT touch other routes, ProjectDetailPage, TaskModal, or other components.
- Do not copy checklist/dependencies/watchers/attachments/comments/time entries.
- Preserve all existing functionality (drag-drop, filters, subtasks, watch, comments, checklist, attachments, time log).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors; run `cd /home/ubuntu/projects/glance/backend && node --check routes/tasks.js`.
- Report exactly what you changed and any issues.
