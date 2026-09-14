# SPEC — Comment Delete (admin/member)

## Objective
Let admins/members delete task comments (spam/mistake cleanup). Comments are currently create-only — there is no way to remove one. This closes the only gap in the comments feature and exactly mirrors the existing delete pattern used for attachments and time entries.

## Assumptions / current state
- Backend `backend/routes/comments.js`: only `GET /task/:taskId` and `POST /task/:taskId`. NO delete. `POST` is `requireRole('admin','member')`.
- `comments` table: `(id, task_id, user_id, body, created_at)`. No soft-delete column; a hard delete is fine (matches the rest of the app — nothing references comments).
- Frontend `frontend/src/components/TaskDetailModal.jsx` renders comments in `.comments-section` (`.comment` rows with `.comment-header` + `.comment-body`), with an add form. No delete button.
- Task detail modal receives `readOnly` prop (`readOnly = hasRole('viewer')`). The app convention: every destructive admin/member action shows its delete (×) button only when `!readOnly` (see Attachments and Time Log sections — copy that exact gate). Comment rows include `c.user_id` (author) and `c.user_name`.
- `logActivity(req.user.id, action, entityType, entityId, entityName, details)` helper is already used by the comment POST.

## Scope — touch ONLY
- `backend/routes/comments.js` — add `DELETE /:id` (member/admin only, matching app convention).
- `frontend/src/components/TaskDetailModal.jsx` — add delete (×) button to each comment row, gated `!readOnly` (copy the attachment/time-entry delete pattern).
- `frontend/src/components/TaskDetailModal.css` — mirror existing comment/delete-button styles (the delete button in comments should reuse the `.btn-ghost.btn-sm` class already used by attachments/time entries; add any minimal `.comment .btn-ghost` spacing if needed).

Do NOT touch other files, database, or other routes.

## Backend — `DELETE /:id` in `backend/routes/comments.js`
- `requireRole('admin', 'member')` on the route (same as POST).
- `const { id } = req.params;` load comment by id → 404 if not found.
- `db.prepare('DELETE FROM comments WHERE id = ?').run(id);`
- Log: `logActivity(req.user.id, 'comment.deleted', 'comment', comment.id, <task title or null>, { task_id: comment.task_id })` — look up the task title via `tasks` table (LEFT JOIN like GET) so activity reads nicely; if the task is gone, `null` is fine.
- Return `{ success: true }`.

## Frontend — `TaskDetailModal.jsx`
- In the `.comment-header` or `.comment` row, when `!readOnly`, render a delete (×) button with class `btn-ghost btn-sm`, `title="Delete"`, mirroring the attachment/time-entry delete buttons exactly.
- `handleDeleteComment(c)`: `if (!window.confirm(`Delete comment by ${c.user_name}?`)) return;` then `await apiFetch('/comments/' + c.id, { method: 'DELETE' })`; on success remove from local `comments` state (`setComments(prev => prev.filter(x => x.id !== c.id))`); on error surface via existing error mechanism (or `alert(err.message)` — match the modal's existing error handling style; keep it minimal).

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. Comment add still works (unchanged).
3. Backend starts cleanly; member/admin can delete any comment via `DELETE /api/comments/:id` → `{success:true}`; comment disappears from `GET /api/comments/task/:taskId`; viewer role → 403; bad id → 404.
4. `activity_log` gains a `comment.deleted` row (visible via `GET /api/activity`).
5. In the UI, a member/admin (not readOnly) sees a delete button on each comment and can remove it; viewer (readOnly) sees no delete buttons.

## Constraints
- Do NOT edit `backend/db.js`. NO schema/migration changes. No destructive/mass commands. No secrets in logs.
- Match existing route/UI style exactly (this is a copy of the attachment/time-entry delete pattern).
- No frontend props/signature changes, no changes to ProjectDetailPage or AuthContext (keep `!readOnly` gate — non-readOnly already means admin/member).

## Verification plan
- `node --check backend/routes/comments.js`.
- Test against a COPY of the LIVE DB (including `.db-wal`/`.db-shm`): start backend on the copy; curl login as admin → create comment → DELETE → 200; verify gone from GET list and `comment.deleted` activity row present; viewer token → 403; bad id → 404.
- `cd frontend && npm run build`.
