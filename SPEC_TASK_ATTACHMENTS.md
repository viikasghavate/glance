# Glance — Task Attachments (frontend UI for existing backend API)

Wire task **file attachments** into the Task Detail modal. The backend
(`backend/routes/attachments.js`, mounted at `/api/attachments`) already has
working, tested endpoints — this spec adds the frontend that uses them so
users can attach, view, download, and delete files on a task.

## Background (current state)
- Backend endpoints already exist and are mounted in `server.js`:
  - `GET  /api/attachments/task/:taskId`    → list attachments for a task (JOINs uploader name as `uploader_name`, newest first)
  - `POST /api/attachments/task/:taskId`    → upload a file (multipart, field name `file`; admin/member only)
  - `GET  /api/attachments/:id/download`    → download the file (`res.download`)
  - `DELETE /api/attachments/:id`           → delete (admin/member only)
- `attachments` table in `backend/db.js`: `id, task_id, filename, stored_path, size, mime_type, uploaded_by, created_at`. Files saved under `backend/uploads/`.
- Frontend task detail modal: `frontend/src/components/TaskDetailModal.jsx` (+ `TaskDetailModal.css`). It already loads comments, checklist, dependencies from the task in a `useEffect` block and has an `apiFetch` prop. It receives `readOnly` (true for viewer role) and `apiFetch`.
- `apiFetch` in `frontend/src/context/AuthContext.jsx` ALWAYS sets `Content-Type: application/json`. For the multipart upload we must NOT send that header — call `fetch` directly with `FormData` and an `Authorization: Bearer <token>` header (token from `localStorage.getItem('token')`), OR extend `apiFetch` to skip the JSON content-type when given a `FormData` body. Prefer the latter: modify `apiFetch` so it only sets the JSON content-type when the body is NOT a `FormData` instance. This is a small, safe change to `AuthContext.jsx`.

## Objective
Show an "Attachments" section inside the Task Detail modal. Users can:
- See a list of attachments on the task (icon, filename, size, uploader, relative time).
- Download an attachment (opens in new tab or triggers download) via the download endpoint.
- Upload a new file (admin/member only).
- Delete an attachment (admin/member only), with a confirm.
Respect `readOnly` (viewer) — no upload/delete controls shown, download still allowed.

## Scope — touch ONLY these files
- `frontend/src/context/AuthContext.jsx` — small change: only set `Content-Type: application/json` when body is not `FormData`.
- `frontend/src/components/TaskDetailModal.jsx` — add attachments state + fetch, upload handler, delete handler, attachments UI section.
- `frontend/src/components/TaskDetailModal.css` — styles for the attachments section (match existing modal styling / neon theme: `--bg-card`, `--border`, `--text`, `--text-muted`, buttons `.btn-ghost .btn-sm`, `.btn-primary`).
- THIS spec file (no source changes elsewhere). Do NOT touch backend. Do NOT touch OTHER frontend files.

## Success criteria
1. Existing comments, checklist, dependencies, and all other modal behavior still work (regression-free).
2. On opening a task, its attachments load and display.
3. Admin/member can upload a file; the upload posts multipart `file` to `/api/attachments/task/:taskId` (no JSON content-type), and the new attachment appears in the list.
4. Clicking an attachment downloads it correctly.
5. Admin/member can delete an attachment after confirming; it disappears from the list.
6. Viewer (`readOnly`) user sees the list + can download, but sees NO upload/delete controls.
7. Empty state: when no attachments, show a muted "No attachments yet" line (or nothing but the section header).
8. `cd /home/ubuntu/projects/glance/frontend && npm run build` succeeds with no errors.

## Constraints
- Do NOT push to GitHub yourself; the orchestrator handles commit/push/deploy. Work only in `/home/ubuntu/projects/glance`.
- Do NOT hand-edit source. Implement via the OpenCode coding agent.
- Never delete data files or run destructive commands.
- Keep it self-contained and small; a single modal section.
