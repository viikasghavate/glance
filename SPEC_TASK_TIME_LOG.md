# SPEC: Task Time Log UI

Add a **Time Log** section to the task detail modal so users can log time entries against a task. The backend API already exists; there is currently zero UI for it (only a read-only "Spent: Xh" meta display and a manual time_spent field).

## Objective
Give users a "Time Log" panel inside `TaskDetailModal` that:
- Lists existing time entries for the task (who logged, minutes, note, when).
- Lets a member/admin log a new time entry (minutes + optional note).
- Lets a member/admin delete a time entry (recomputes the task's `time_spent`).
- Displays a running total (total minutes logged = task `time_spent`).

## Background / current state
- Backend already provides (do NOT modify backend):
  - `GET /api/tasks/:id/time-entries` → `[{id, task_id, started_at, ended_at, minutes, note, created_at, user_name}]`
  - `POST /api/tasks/:id/time-entries` body `{ minutes, note }` (member/admin only; recomputes `time_spent`)
  - `DELETE /api/time/:id` (member/admin only; recomputes `time_spent`)
- `TaskDetailModal` is at `frontend/src/components/TaskDetailModal.jsx`. It already includes sibling sections: Checklist (`.checklist-section`) and Attachments (`.attachments-section`) with the exact patterns to copy (loading state, empty state, add-form, list, per-item actions). It receives `apiFetch`, `task`, `readOnly` props.
- Component styles live in `frontend/src/components/TaskDetailModal.css`.
- Helper `apiFetch(path, opts)` already available via props (used for comments/checklist/attachments).

## Scope — touch ONLY
- `frontend/src/components/TaskDetailModal.jsx` — add Time Log section (state, fetch on mount, add handler, delete handler, render).
- `frontend/src/components/TaskDetailModal.css` — styles for `.time-log-section`, `.time-entry`, forms, etc. (mirror existing checklist/attachments styles).

Do NOT touch the backend. Do NOT touch other files.

## Behavior
- On modal open, fetch `/tasks/{task.id}/time-entries` and store entries.
- Render a `Time Log` section (place it after the Attachments section) with:
  - Count/total badge: "Time Log — X entries · Yh logged" (Y = sum of minutes/60, one decimal).
  - Entry list (newest first): each row shows `user_name`, `minutes` formatted (e.g. "30 min" or "1.5 h"), `note` (if any), relative/`created_at` date, and a delete button (member/admin only, not readOnly).
  - Empty state: "No time logged yet."
  - Add form (member/admin only, not readOnly): minutes number input (required, ≥0.25) + optional note text + "Log Time" submit button. Disable submit when minutes invalid.
- On successful add, refresh the entry list AND call `onUpdate({ time_spent })`-style refresh so the modal's task object reflects the new total. Simplest: after add/delete, re-fetch the task via `onUpdate` with the new recomputed time_spent — the safest is to re-fetch `/tasks/{task.id}/time-entries` for the list and call `onUpdate({ time_spent: newTotal })` with the server-recomputed total returned from the POST (`/tasks/:id/time-entries` POST does NOT return time_spent). To keep it simple and correct: after add/delete, re-fetch the entries, sum minutes locally for the total badge, and call `onUpdate({})` if available to trigger parent re-fetch of the task. If `onUpdate` requires specific fields, re-fetching the task is acceptable — prefer minimal: update the local total badge from the entries sum, and leave the parent task `Spent` meta as-is (it updates on next task refresh). Do the least disruptive thing that is correct.
- Deleting: confirm via `confirm()` (matching app conventions), call `DELETE /time/{id}`, then refresh.

## Constraints
- Must pass `cd frontend && npm run build` clean.
- Preserve all existing functionality.
- Match existing UI conventions (buttons, empty states, section headers) exactly — this is a visual copy of the attachments/checklist sections.

## Success criteria (verifiable)
1. `npm run build` passes.
2. Task detail modal shows a Time Log section with total.
3. Member/admin can log minutes+note; entry appears in list; total updates.
4. Member/admin can delete an entry; list + total update; no error.
5. Empty state shows when no entries.
6. `readOnly` (viewer) users see the list + total but NO add form / delete buttons.
