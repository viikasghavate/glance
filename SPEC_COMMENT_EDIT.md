# SPEC — Edit a Comment (backend PATCH + edit UI in Task Detail modal)

## Objective
Let a member/admin **edit an existing comment** on a task directly from the Task Detail
modal. Today a user can add and delete comments but cannot fix a typo or update wording —
an annoying gap. Add a `PATCH /api/comments/:id` backend endpoint and an Edit affordance
in the comment list (edit-in-place textarea + Save/Cancel). Closes the comment edit gap;
delete stays as-is.

## Assumptions (verified in repo, main branch)
- Backend `backend/routes/comments.js`, mounted at `/api/comments`, `router.use(requireAuth)`.
  Existing routes: `GET /task/:taskId`, `POST /task/:taskId` (admin/member), `DELETE /:id` (admin/member).
  `comments` table columns: `id, task_id, user_id, body, created_at`. No `updated_at` column exists.
- Frontend Task Detail modal `frontend/src/components/TaskDetailModal.jsx`:
  - has `apiFetch`, `task`, `readOnly` props.
  - comment state: `const [comments, setComments] = useState([])`; loaded via
    `apiFetch(\`/comments/task/${task.id}\`)`.
  - `handleDeleteComment(c)` (gated `!readOnly`) with a `window.confirm`.
  - Renders each comment as:
    ```
    <div key={c.id} className="comment">
      <div className="comment-header">
        <span className="comment-author">{c.user_name}</span>
        <span className="comment-date">{new Date(c.created_at).toLocaleString()}</span>
        {!readOnly && (
          <button ... onClick={() => handleDeleteComment(c)} title="Delete">&times;</button>
        )}
      </div>
      <p className="comment-body">{c.body}</p>
    </div>
    ```
  - `frontend/src/components/TaskDetailModal.css` has `.comment`, `.comment-header`,
    `.comment-author`, `.comment-date`, `.comment-body`, `.comment-form`, `.comment-form textarea`.
- App convention: every mutating action is gated by `readOnly` (viewer role never sees
  mutating controls). Add/edit/delete all mutate → gate with `!readOnly`.

## Scope — touch ONLY
Backend:
- `backend/routes/comments.js` — add one route: `PATCH /api/comments/:id` (admin/member only).

Frontend:
- `frontend/src/components/TaskDetailModal.jsx` — edit-in-place UI.
- `frontend/src/components/TaskDetailModal.css` — only if a new class is required
  (reuse `comment-form`/`comment-form textarea` for the edit textarea; add a small
  `.comment-actions` / edit-button style if needed, prefer reusing `btn-ghost btn-sm`).

Do NOT touch db.js (no schema change — no `updated_at`), server.js, other routes,
TaskModal, other components/pages, package.json. No drive-by refactors.
Keep add + delete behavior intact.

## Backend — `PATCH /api/comments/:id`
1. `requireRole('admin','member')` (like POST/DELETE).
2. Load comment by `:id`; if missing → `404 { error: 'Comment not found' }`.
3. Body: `{ body: string }`. Validate present, non-empty after trim (mirror POST which
   rejects empty body). If absent/empty → `400 { error: 'body is required' }`.
4. `UPDATE comments SET body = ? WHERE id = ?` with the trimmed body.
5. Re-select the updated comment (same JOIN as POST: `SELECT c.*, u.name as user_name,
   u.email as user_email ... WHERE c.id = ?`) and return it as `200` JSON.
6. `logActivity(req.user.id, 'comment.edited', 'comment', comment.id, taskTitle, { task_id: ... })`
   — mirror the existing DELETE pattern (load the comment's `task_title` first for the
   activity `entity_name`). Do not re-notify (no new notification on edit — only on add).

## Frontend — `TaskDetailModal.jsx`
Add **edit-in-place** for each comment (gated `!readOnly`):
1. State: `const [editingCommentId, setEditingCommentId] = useState(null);` and
   `const [editBody, setEditBody] = useState('');`.
2. An **Edit** button next to the existing Delete button in `.comment-header` (only when
   `!readOnly`). It sets `editingCommentId = c.id`, `editBody = c.body`.

   Do NOT gate edit by "owns the comment" — the app is a small personal tool and the
   existing delete is also allowed for any member/admin on any comment. Keep it consistent
   (any member/admin can edit any comment), same as delete.
3. When a comment is being edited (`editingCommentId === c.id`), replace the rendered
   `<p className="comment-body">{c.body}</p>` with:
   ```
   <form onSubmit={handleSaveEditComment} className="comment-form">
     <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2} autoFocus />
     <button type="submit" className="btn-primary btn-sm" disabled={!editBody.trim()}>Save</button>
     <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingCommentId(null)}>Cancel</button>
   </form>
   ```
4. Handler: `const handleSaveEditComment = async (e) => { e.preventDefault(); if (!editBody.trim()) return; try { const updated = await apiFetch(\`/comments/${editingCommentId}\`, { method: 'PATCH', body: JSON.stringify({ body: editBody.trim() }) }); setComments(prev => prev.map(c => c.id === updated.id ? updated : c)); setEditingCommentId(null); } catch (err) { alert(err.message || 'Failed'); } };`
5. While editing, the comment's Delete button may stay visible (harmless) or be hidden —
   simplest: keep it. Do not add complexity.

## Success criteria
1. `cd frontend && npm run build` passes clean.
2. `curl`-style check (or via app): `PATCH /api/comments/:id` with a body updates the
   comment and returns the updated row with `user_name`; empty body → 400; unknown id → 404.
3. In the modal: Edit button appears (member/admin, not viewer); clicking shows the textarea
   prefilled with the comment body; Save persists and the list shows the new text; Cancel
   discards and returns to the original text.
4. Add + delete still work; viewer (`readOnly`) sees comments with no Edit/Delete/add form.
5. No regression in comment rendering/ordering (still by `created_at ASC`).
6. Verified against a **COPY of the live DB** (with real comments/users) — no errors,
   no column/index errors.

## Constraints
- No DB schema change, no migration, no new dependencies.
- Do not hand-edit source directly — implement via the coding agent.
- Keep prod healthy; no destructive operations.
- Match existing UI conventions exactly (mirror the comment form and button styles).
