# SPEC — Task Status History UI (read-only section in Task Detail modal)

## Objective
The backend already records task status changes into `task_status_history` and serves them via `GET /api/tasks/:id/status-history`, but there is **no frontend UI** to see them (verified: the served bundle has zero references to `status-history`). Add a small, read-only **Status History** section to the Task Detail modal so users can see when a task's status changed, to what, and by whom. This is the audit/history surface the data-model work already enabled.

## Current state (verified)
- Backend endpoint exists — `backend/routes/tasks.js`, `GET /api/tasks/:id/status-history` (mounted under `/api`, authenticated). Returns rows:
  `[{ id, status, user_id, changed_at, user_name }]` ordered by `changed_at ASC, id ASC`.
- Data is recorded on status change (`backend/routes/tasks.js` inserts into `task_status_history` on PATCH status / status reorder).
- `task_status_history` columns: `id, task_id, status, user_id, changed_at`.
- `TaskDetailModal.jsx` already loads several sub-resources on mount with a consistent pattern (fetchComments, fetchChecklist, fetchAttachments, fetchTimeEntries, fetchWatchers): each has `useState` + `useEffect(() => { fetchX(); }, [task.id])`. **Copy this exact pattern.**
- Status values are `todo | in_progress | done`. Labels used elsewhere in the app: `todo: 'To Do'`, `in_progress: 'In Progress'`, `done: 'Done'` (see `TimelineView.jsx` STATUS_LABELS; mirror these).
- The modal receives `apiFetch` and `task` props. It is read-only-safe: this section is read-only so show it for ALL roles including `readOnly` viewers (no mutating action).
- Rendering anchor: the modal renders sections like `.time-log-section` with an `<h4>` header, a loading spinner state, and an `.empty` message. Mirror the Time Log section's structure.

## Scope — touch ONLY
- `frontend/src/components/TaskDetailModal.jsx` — add Status History state + fetch + render.
- `frontend/src/components/TaskDetailModal.css` — minimal styles for the new section (mirror existing `.time-log-section`/`.time-entry` styles; only add rules if genuinely needed).

Do NOT touch backend, db, other routes, other components, or the parent page. No schema changes. No API changes.

## Behavior
- On modal mount, fetch `/tasks/{task.id}/status-history` and store rows.
- Render a `Status History` section (place AFTER the Time Log section, BEFORE the Comments section — the ordering follows the modal's left/right column stack; place it adjacent to time log).
- Header: `Status History` (optionally with row count badge, e.g. `Status History {rows.length}` — mirror the Attachments count badge style if easy, else plain `<h4>`).
- List each row as:
  - status label (e.g. "In Progress") — render the mapped label via a `STATUS_LABELS` map; unknown status → fall back to the raw value.
  - user name (`user_name`, fallback "System" if null/empty — the backend LEFT JOINs users so `user_id` may be null).
  - relative/absolute timestamp from `changed_at` (reuse the modal's existing `relativeTime` helper if present, else `new Date(changed_at).toLocaleString()`).
- Empty state: `No status changes recorded yet.` (mirror `.empty` class).
- Loading state: `<div className="loading"><div className="spinner" /></div>` (mirror siblings).
- Read-only: this section has NO buttons/forms — works for viewer roles too. Do not gate on `!readOnly`.

## Success criteria
- After `npm run build`, the served bundle contains the `status-history` fetch + Status History render.
- The Status History section appears in the Task Detail modal and lists status-change rows with label, user, and time.
- Empty tasks (no history) show the empty message; tasks with history list rows (newest→oldest NOT required — keep backend's ASC order, it's the timeline).
- No regression to other modal sections (build passes, checklist/attachments/time-log/comments still render).

## Constraints
- Keep it small and self-contained. Match existing patterns. Do NOT hand-edit source directly — implement via the OpenCode coding agent.
- Do NOT push this feature spec's commit until build passes against a copy of the live DB.
