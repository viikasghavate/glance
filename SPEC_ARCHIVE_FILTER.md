# SPEC — Archive Filter Toggle (hide/show archived tasks)

## Objective
Let users hide (or show) archived tasks in a project's **Board / List / Timeline** views. Tasks already carry an `archived` flag (0/1) returned by `GET /api/tasks/project/:projectId`, and archived tasks are already styled with dimmed `.archived` CSS. What's missing: a way to filter them out so completed/archived clutter doesn't pollute the working board.

## Current state
- `backend/routes/tasks.js` `GET /project/:projectId` returns every task with its `archived` field — no backend filter needed.
- `frontend/src/pages/ProjectDetailPage.jsx` holds `tasks` state, fetches via `/tasks/project/${id}`, and passes the full array to `<KanbanBoard tasks=/>`, `<TaskList tasks=/>`, and `<TimelineView tasks=/>`. No archive filtering today.
- `TaskModal.jsx` has an "Archived" checkbox that sets `archived`. `TaskList.css` and `KanbanBoard.css` already dim `.archived` rows/cards.

## Scope — touch ONLY
- `frontend/src/pages/ProjectDetailPage.jsx`
- `frontend/src/pages/ProjectDetailPage.css`

No backend changes. No other components.

## Frontend — `ProjectDetailPage.jsx`
1. **Add state**: `const [showArchived, setShowArchived] = useState(false);`
2. **Derived filter**: before rendering the three view components, compute
   `const visibleTasks = showArchived ? tasks : tasks.filter(t => !t.archived);`
   Pass `visibleTasks` to `KanbanBoard`, `TaskList`, `TimelineView` instead of `tasks`.
3. **Toggle UI**: add a small toggle button in the `.view-actions` row (next to "Export CSV"), labeled **Show archived**.
   - Label reflects state: when `showArchived` is true show "Hide archived", else "Show archived".
   - Use existing button styles (`btn-ghost btn-sm` or the pattern already used in this page) consistent with the Neon theme. Active state can use the accent/glow styles already present.
4. Keep everything else identical: task detail deep-link (`?task=`), New Task modal, drag/reorder, filters — all operate on `visibleTasks` now. Deep-link lookup still uses the full `tasks` array (so opening a link to an archived task still finds it) — see the `?task=` useEffect; keep that using `tasks` (full), not `visibleTasks`.

## Success criteria
1. With `showArchived` off (default), `visibleTasks` excludes archived tasks in all three views.
2. With `showArchived` on, archived tasks appear again (dimmed via existing CSS).
3. Toggle state is per-page-load (no persistence required).
4. `npm run build` in `frontend/` passes with no errors/warnings introduced.
5. No regression: viewing, editing, dragging, deep-link to a task still work.

## Constraints
- Do NOT change backend or DB. Do NOT touch TaskList/KanbanBoard/TimelineView components' props beyond passing the filtered array.
- Preserve the Neon Cyberpunk theme; use existing button classes.
- Guardrails: never delete data, no destructive commands, don't expose secrets.

## Verification
- `cd /home/ubuntu/projects/glance/frontend && npm run build` → succeeds.
- Manual: open a project with an archived task → default hides it; click "Show archived" → it appears; toggle back → hides.
