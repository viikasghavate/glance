# SPEC — Watch / Unwatch Task from Task Detail Modal

## Objective
Let any member/admin quickly **watch or unwatch a task** right from the Task Detail modal (the read-only popup you open by clicking a card). Watching currently exists only in the *edit* modal (`TaskModal`); the detail modal — the surface users actually live in — has no way to follow a task you're not assigned to. This closes that gap and directly feeds the notification bell (watchers get `comment_added` notifications).

## Assumptions / current state
- Backend already has the watchers API and it works:
  - `GET    /api/tasks/:id/watchers` → `[{id, name, email}, ...]` (any authed user)
  - `POST   /api/tasks/:id/watchers` → add **current user** (`requireRole('admin','member')`)
  - `DELETE /api/tasks/:id/watchers` → remove **current user** (`requireRole('admin','member')`)
  - `TaskModal.jsx` already consumes these — proof the endpoints work. Same pattern must be reused, **not** reinvented.
- `TaskDetailModal.jsx` receives `{ task, tasks, users, onClose, onUpdate, onDelete, apiFetch, readOnly }` from `ProjectDetailPage.jsx`. It does NOT currently read the watching state.
- `readOnly` is `true` when the viewer has only the `viewer` role. The app convention: every mutating action is gated by `readOnly` (viewer never sees it). Watch/unwatch mutates → must be gated `!readOnly`.
- The modal already fetches 3 sub-resources on mount with a consistent pattern (`fetchComments`, `fetchChecklist`, `fetchAttachments`, `fetchTimeEntries`) — each `useState` + `useEffect(() => { fetchX(); }, [task.id])`. Copy this exact pattern for watchers.

## Scope — touch ONLY
- `frontend/src/components/TaskDetailModal.jsx`
- `frontend/src/components/TaskDetailModal.css`

Do NOT touch backend, db, other routes, ProjectDetailPage, AuthContext, TaskModal, or any other component.

## Frontend — `TaskDetailModal.jsx`
1. **State + fetch**
   - `const [watchers, setWatchers] = useState([]);`
   - `const [loadingWatchers, setLoadingWatchers] = useState(false);`
   - `const fetchWatchers = async () => { setLoadingWatchers(true); try { const data = await apiFetch(\`/tasks/${task.id}/watchers\`); setWatchers(data); } catch (err) { console.error(err); } finally { setLoadingWatchers(false); } };`
   - `useEffect(() => { fetchWatchers(); }, [task.id]);` (mirror the other sub-resource fetch effects exactly).
2. **Current-user detection**
   - The modal does NOT receive the current user object. Use `import { useAuth } from '../context/AuthContext';` inside the modal and `const { user } = useAuth();` to get `user.id`, matching exactly how `TaskModal.jsx` computes `isWatching`:
     - `const isWatching = watchers.some(w => w.id === user?.id);`
     - Note: `GET /watchers` returns `id` (user id). Confirm `user.id` is a number to match (TaskModal works with these same values today — replicate it).
3. **Toggle handler** — copy the TaskModal pattern verbatim:
   - `const handleToggleWatch = async () => { if (isWatching) { await apiFetch(\`/tasks/${task.id}/watchers\`, { method: 'DELETE' }); } else { await apiFetch(\`/tasks/${task.id}/watchers\`, { method: 'POST' }); } await fetchWatchers(); };` (wrap in try/catch with `console.error` like neighbors).
4. **Render** — add a small, unobtrusive **watch button** in the modal header area (e.g. next to the task title / status row, near the top where the task title and status badges are rendered). Show it **only when `!readOnly`**.
   - Button text: `Watch` / `Unwatch` depending on `isWatching` (with `loadingWatchers` disabled/spinner state).
   - Class: reuse existing button classes (`btn-ghost btn-sm` — the same ones TaskModal and the comment/attachment delete buttons use) so no new design system is introduced.
   - If `readOnly` (viewer), render nothing.

## Frontend — `TaskDetailModal.css`
- Add only minimal spacing for the new header button if needed (reuse existing utility classes first; only add rules if something is genuinely off). Keep it tiny.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. In the Task Detail modal, an admin/member (`!readOnly`) sees a `Watch`/`Unwatch` toggle that:
   - shows `Watch` when the current user is NOT watching (and clicking it POSTs, then shows `Unwatch`);
   - shows `Unwatch` when the current user IS watching (and clicking it DELETEs, then shows `Watch`); persists across modal re-open and page reload (server-backed).
3. A `viewer` (readOnly) sees NO watch button.
4. Existing behavior unchanged: comments, checklist, attachments, time log still work; TaskModal watch UI untouched.
5. No backend/schema changes.

## Constraints
- Do NOT edit `backend/**`, `db.js`, `ProjectDetailPage.jsx`, `AuthContext.jsx`, `TaskModal.jsx`. Frontend-only in the two listed files.
- Match existing pattern exactly (this is a straight copy of the watcher code from TaskModal + the modal's own sub-resource fetch pattern). Do not introduce new state mgmt or a different watch model.
- No secrets, no destructive commands.
