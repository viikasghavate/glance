# Glance — Deep-link to a specific task from Global Search

## Objective
When a user clicks a **Task** or **Comment** result in the top-bar global search dropdown, the app should not only navigate to that task's project page but also **auto-open that task's detail modal**, so the user lands directly on the record they searched for instead of having to find it manually in the board/list.

## Current state (verified)
- Backend `GET /api/search?q=` (`backend/routes/search.js`) already returns for tasks: `{ id, title, project_id, project_name, status }` and for comments: `{ id, body, task_id, project_id, task_title, user_name }`. Both already carry the task id + project id. **No backend change needed.**
- `frontend/src/components/Layout.jsx` global search dropdown already calls `handleSearchSelect(path)` which does `navigate(path)`. For tasks it currently navigates to `/project/${t.project_id}`; for comments to `/project/${c.project_id}` (both ignore the specific task).
- `frontend/src/pages/ProjectDetailPage.jsx` already has `selectedTask` state and renders `TaskDetailModal` when `selectedTask` is set (via `onTaskClick`, `handleTaskUpdate`, `handleTaskDelete`). Task objects come from `apiFetch('/tasks/project/:id')`.

## Scope — frontend only, two files
1. `frontend/src/components/Layout.jsx`
   - Task result click → `handleSearchSelect(`/project/${t.project_id}?task=${t.id}`)`
   - Comment result click → `handleSearchSelect(`/project/${c.project_id}?task=${c.task_id}`)`
   - Project result click → unchanged (`/project/${p.id}`).
2. `frontend/src/pages/ProjectDetailPage.jsx`
   - Read `task` from `useSearchParams()` (from `react-router-dom`, already available — add import if needed).
   - After tasks are loaded (`fetchData` sets `tasks`), if a `task` param exists, find that task in `tasks` and `setSelectedTask(foundTask)`. Clear the param after opening so a reload/back doesn't re-trigger (use `setSearchParams({}, { replace: true })` or navigate to the bare path).
   - If the task id is not in the loaded list (e.g., filtered/deleted), do nothing (just show the project, no error).
   - When the detail modal closes, it must not reopen — only auto-open once on initial load.

## Assumptions
- `react-router-dom` version supports `useSearchParams` (it does — same major as `useNavigate`/`useParams` already used).
- Task objects in the loaded `tasks` array match the shape used by `TaskDetailModal` (they already do — `selectedTask` is set from `onTaskClick` with the same object).
- No backend, no DB schema, no migration changes.

## Success criteria
1. Clicking a Task search result navigates to the project and immediately opens that task's detail modal.
2. Clicking a Comment search result opens the detail modal for the comment's task.
3. Project results behave exactly as before (no modal).
4. Closing the modal does not auto-reopen it (param cleared).
5. Reloading or manually visiting `/project/:id?task=N` re-opens the modal only when the task exists in the project's task list.
6. `cd frontend && npm run build` passes with no errors.

## Constraints
- Frontend only. Do not edit `backend/`. Do not edit `SPEC_SEARCH_TASK_DEEPLINK.md`. Do not run destructive commands.
- Preserve the neon dark theme and existing search dropdown behavior.
- Keep the change minimal and consistent with existing code style.
- After building successfully, report exactly what you changed and the build result. Do NOT push to GitHub (the coordinator handles commit + deploy).

## Deliverables
- Layout.jsx navigates task/comment results with `?task=` param.
- ProjectDetailPage.jsx auto-opens the task detail modal from the `task` param, once, and clears the param.
- `npm run build` passes.
