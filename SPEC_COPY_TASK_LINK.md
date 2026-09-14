# SPEC — Copy Task Link (Task Detail modal)

## Goal
Add a **Copy Task Link** button to the Task Detail modal so a user can copy a shareable deep-link to any task. The deep-link mechanism already exists (`/project/:projectId?task=:taskId`, used by notifications, global search, and My Tasks) — we just surface a way to copy it.

## Feature
- In `frontend/src/components/TaskDetailModal.jsx`, add a **Copy Link** button in the header action row (with Watch / Duplicate buttons).
- On click, build `const url = window.location.origin + '/project/' + task.project_id + '?task=' + task.id;` and copy to clipboard via `navigator.clipboard.writeText(url)`.
- Give brief visual feedback: button text flips to "Copied!" for ~1.5s, then reverts.
- Handle clipboard failure gracefully (fallback to `document.execCommand('copy')` on a temp textarea, or just show "Copy failed" — keep simple). Best: try clipboard API, fallback to temp-textarea execCommand.
- The button should work for ALL users (including `readOnly`/viewer), so it sits OUTSIDE the `!readOnly` guard.

## Assumptions
- `task.project_id` is available on the `task` prop (tasks come from the project tasks endpoint / my-tasks, both return project_id).
- App is served from root (`/`), so an origin-relative path works.

## Scope
- Frontend only. One component file. No backend change, no DB schema change.

## Success criteria
- Button appears for all roles in the Task Detail modal header.
- Clicking copies `https://<host>/project/<project_id>?task=<task_id>` to clipboard.
- Button shows "Copied!" transiently after clicking.
- Opening the copied link deep-links into that task's detail modal (existing behavior, no regression).

## Constraints
- Keep style consistent with existing `btn-ghost btn-sm` buttons in the header.
- Do not touch backend or database.
- Must pass `npm run build` in frontend/.
