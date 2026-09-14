# SPEC — Notification Click Deep-Links to Task Detail

## Objective
When a user clicks a notification in the top-bar bell dropdown, they should be taken
directly to the specific task when the notification carries a `task_id` in its payload
— not just to the project. The project detail page already opens a task detail modal
from the `?task=<id>` query param via the global search deep-link. Reuse that same
mechanism.

## Assumptions / Current state
- `frontend/src/components/Layout.jsx` `handleNotificationClick(n)`:
  - parses `n.payload` (a JSON string) → `{ project_id, task_id }`.
  - if `projectId != null` it `navigate(\`/project/${projectId}\`)`.
  - It currently **ignores** `payload.task_id`.
- `frontend/src/pages/ProjectDetailPage.jsx` already reads `?task=<id>` via
  `useSearchParams` and auto-opens that task's detail modal (used by global search,
  which navigates to `/project/:project_id?task=<task_id>`). Verify this behavior.
- Backend `backend/services/notifications.js` already populates `payload`
  with both `task_id` and `project_id` for `task_assigned`, `comment_added`,
  and `dependency_done` notifications.
- Notifications are per-user; the bell dropdown renders them in `Layout.jsx`.

## Scope
- **Backend:** No change. Payload already contains `task_id` + `project_id`.
- **Frontend (only `Layout.jsx`):** In `handleNotificationClick`, when the parsed
  payload has both `project_id` and `task_id`, navigate to
  `/project/${project_id}?task=${task_id}`. If only `project_id` present (no
  task_id), fall back to `/project/${project_id}`.

## Success criteria
1. Clicking a notif with `payload.task_id` navigates to
   `/project/<id>?task=<task_id>` and the matching task detail modal opens.
2. Clicking a notif with only `project_id` still navigates to the project (no
   regression).
3. Marking-read behavior unchanged (notif marked read, dropdown closes).
4. `npm run build` passes in `frontend/`.

## Constraints
- Do NOT modify backend routes, notifications table, or other components.
- Match existing deep-link URL format exactly (`?task=<id>`) so ProjectDetailPage
  handles it.
- Keep prod healthy; no destructive operations.
- Implement via the coding agent (`~/.opencode/bin/opencode`) — do not hand-edit
  source files directly.

## Verification
- `cd frontend && npm run build` succeeds.
- Backend loads without errors (`node backend/server.js` or project normal start).
- Manual: with a task_assigned/comment notification present, clicking it opens the
  task detail modal.
