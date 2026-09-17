# SPEC — Task List status cell: preserve badges when inline status editor is enabled

## Objective
Give users the option of the compact status **badge** or the inline status **dropdown** in the List view, instead of the dropdown being forced on everyone. This closes the last status-cell parity gap: Kanban, Timeline and My Tasks all render a read-only status badge, while `TaskList` always renders a `<select>`.

## Current state
- `frontend/src/components/TaskList.jsx` renders the Status column as a `<select className="status-select">` unconditionally (both for editors and viewers — `readOnly` currently only disables row dragging, not the status select).
- `frontend/src/components/TaskList.css` line ~45 defines the row grid: `grid-template-columns: 28% 16% 12% 10% 12% 10% 6% 6%;`.
- `KanbanBoard.jsx` / `TimelineView.jsx` / `MyTasksPage.jsx` render `<span className={`badge badge-${task.status}`}>` with label mapping `todo → To Do`, `in_progress → In Progress`, `done → Done`.
- `frontend/src/pages/ProjectDetailPage.jsx` owns `TaskList` usage (`view === 'list'`) and already passes `onStatusChange` + `readOnly`.

## Scope — touch ONLY
- `frontend/src/components/TaskList.jsx`
- `frontend/src/components/TaskList.css`
- `frontend/src/pages/ProjectDetailPage.jsx`

No backend changes. No DB changes. No other components/pages.

## Implementation
### `TaskList.jsx`
1. Add a new prop `badgeStatus` with a safe default: `export default function TaskList({ ..., badgeStatus = false })`.
2. Add local state: `const [showStatusBadges, setShowStatusBadges] = useState(!!badgeStatus);`
3. In the toolbar (`.task-filters`), after the sort-direction toggle button, add a toggle button following the existing `btn-ghost btn-sm` pattern:
   - Label: `Badges` when `showStatusBadges` is true, `Status dropdowns` when false.
   - `title="Toggle status badges / inline dropdowns"`.
   - Clicking flips `showStatusBadges`.
4. Render condition:
   - When `readOnly || showStatusBadges` → render `<span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>` (use the existing `statusLabel` helper already defined in the file).
   - Otherwise → render the existing `<select className="status-select">` unchanged (keep `onClick={e => e.stopPropagation()}` and `onChange`).
   - Note: `readOnly` must now also suppress the select. This is intentional — viewers should not get a status editor.
5. `statusLabel` currently maps `todo/in_progress/done`; keep as-is.

### `TaskList.css`
- In the row grid (`grid-template-columns: 28% 16% 12% 10% 12% 10% 6% 6%;` at ~line 45) widen the Status column (3rd value) from `12%` to `14%` and reduce the Title column (1st value) from `28%` to `26%` so badge labels like "In Progress" fit without clipping.
- Ensure the head row and body rows both use the same rule (they already share `.task-table-row`); do not introduce a second grid definition.

### `ProjectDetailPage.jsx`
- Where `TaskList` is rendered for `view === 'list'`, pass `badgeStatus={true}` so the default project List view shows readable badges, while the dropdown stays one click away. Keep passing `readOnly={hasRole('viewer')}` and all existing props.

## Success criteria
1. `npm run build` in `frontend/` succeeds with no new warnings/errors.
2. Default project List view shows status **badges** (not dropdowns).
3. Clicking the new toolbar toggle switches to inline status dropdowns and back; changing a status via the dropdown still calls `onStatusChange(task.id, value)` and persists.
4. Viewers (`readOnly`) never see the status dropdown, only badges.
5. Row drag-to-reorder still works, subtask indentation and collapse/expand unaffected, all existing filters/sort/search unaffected.
6. No other page or component changes behavior.

## Constraints
- Do NOT change the backend, DB schema, or any file outside the three listed.
- Preserve the Neon Cyberpunk theme; reuse existing `btn-ghost btn-sm` / `badge badge-*` classes — do not add new colour values.
- Guardrails: never delete data, no destructive commands, do not expose secrets, do not push to a remote.

## Verification (run these)
- `cd /home/ubuntu/projects/glance/frontend && npm run build`
- `cd /home/ubuntu/projects/glance && grep -n "badge-${task.status}\|status-select" frontend/src/components/TaskList.jsx` — both paths present and guarded.
- Confirm `grid-template-columns` in `TaskList.css` sums to 100%.
