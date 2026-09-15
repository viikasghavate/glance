# SPEC: Label Filter on My Tasks view

## Objective
Add a **Label** filter dropdown to the My Tasks page (`/mytasks`), restoring parity with the List, Kanban, and Timeline views — the three other task views all already have a "All Labels / <label>" filter. My Tasks is the only one missing it.

## Background / Current State
- The backend `GET /api/tasks/mine` route already returns `labelList` (array of `{id, name}`) on every task — no backend change needed.
- `MyTasksPage.jsx` already has filter state for `filter`, `search`, `sortBy/sortDir`, `dueFilter`, `priorityFilter`, `assigneeFilter` and an `assigneeOptions` memo derived from `tasks`.
- List (`TaskList.jsx`), Kanban (`KanbanBoard.jsx`), Timeline (`TimelineView.jsx`) all build a `distinctLabels` memo from `t.labels` (comma-separated string) and filter with `t.labels.split(',').includes(filterLabel)`.
- NOTE: `/mine` payload includes BOTH the legacy `labels` comma-string column AND `labelList`. Use `labelList` (the normalized join) for robustness; fall back to `t.labels` comma-string if labelList is empty.

## Scope
Frontend-only change to `frontend/src/pages/MyTasksPage.jsx` (and small CSS if needed in `MyTasksPage.css`). No backend, no schema, no data migration.

## Implementation (Karpathy — minimal, consistent with existing patterns)
1. Add state `const [labelFilter, setLabelFilter] = useState('');` next to the other filter states.
2. Add a `distinctLabels` memo (same pattern as the existing `assigneeOptions` memo) collecting distinct label names from `task.labelList` (fallback: `task.labels` comma-split) across all tasks, sorted alphabetically.
3. In the `filtered` useMemo, add a label filter step:
   `result = result.filter(t => !labelFilter || labelNames(t).includes(labelFilter.toLowerCase()));`
   where labelNames derives names from `t.labelList` (fallback `t.labels`).
4. Add the label filter control to the JSX toolbar next to the priority/assignee selects (reuse existing select styling classes). Options: `<option value="">All Labels</option>` + one per distinct label. Lowercase-normalize label values for matching (labels may have mixed case).
5. Add `labelFilter` to the useMemo dependency array.

## Success Criteria
- My Tasks toolbar shows a "All Labels" dropdown listing every distinct label among the user's tasks.
- Selecting a label filters the list to tasks carrying that label (via labelList, or labels column).
- Unselecting ("All Labels") restores the full list.
- Search, sort, due/priority/assignee filters, and status chips all still work together with the label filter (combined filtering preserved).
- `npm run build` (frontend) passes; app still renders and the My Tasks page functions.

## Constraints / Guardrails
- Frontend-only. Do NOT modify backend, DB schema, or migrations.
- Do NOT alter the existing filter toolbar layout/behavior; add the label select consistently beside the existing selects.
- Never hand-edit source yourself — make all changes through the OpenCode coding agent.
- No destructive commands. Keep prod healthy.
- Follow the app's existing dark styling (CSS variables: cyan/magenta accents).
