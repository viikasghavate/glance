# Glance — Friendly Empty States for List / Kanban / My Tasks views

## Objective
When a filter (or an empty project) yields zero visible tasks, the app currently shows a nearly-blank column/table with no guidance. Add a small, friendly empty-state message in the List, Kanban, and My Tasks views so users understand there's simply nothing to show and (for members) how to add a task.

## Assumptions / current state
- Frontend is React/Vite, in `frontend/src/`.
- View components receiving a `tasks` array prop:
  - `frontend/src/components/TaskList.jsx` (List view)
  - `frontend/src/components/KanbanBoard.jsx` (Kanban view)
  - `frontend/src/pages/MyTasksPage.jsx` (My Tasks page)
- These components already render a header/columns even when `tasks.length === 0` — the empty body is just blank.
- `readOnly` is passed to TaskList and KanbanBoard (viewers can't create tasks).

## Scope — touch ONLY
- `frontend/src/components/TaskList.jsx`
- `frontend/src/components/KanbanBoard.jsx`
- `frontend/src/pages/MyTasksPage.jsx`
- A small shared CSS addition (reuse existing `.empty-state`-style tokens in `frontend/src/index.css` or add a minimal `.empty-state` rule to `TaskList.css`/`KanbanBoard.css`).

Do NOT touch backend, routing, other components, theme colors, or global layout. Preserve the existing neon/cyberpunk theme and all functionality. No new dependencies.

## Frontend spec

### 1. TaskList.jsx
- After rendering the table header (which stays, so the columns are still visible), when `tasks.length === 0` render an empty-state row spanning all columns:
  ```jsx
  {tasks.length === 0 ? (
    <tr className="empty-row">
      <td colSpan={...}>
        <div className="empty-state">
          {readOnly
            ? 'No tasks match the current filters.'
            : 'No tasks yet. Click "New Task" to add one, or clear your filters.'}
        </div>
      </td>
    </tr>
  ) : (
    ...existing rows...
  )}
  ```
- `colSpan` must equal the number of `<th>` columns in the header. Count them from the actual JSX — do not hardcode if it's dynamic.

### 2. KanbanBoard.jsx
- When `tasks.length === 0`, still render the three column headers (status names + counts = 0) but in each column body render a small muted message instead of nothing, e.g. `"No tasks"` centered. Simpler and cleaner: render a single full-width empty-state banner above the columns when `tasks.length === 0`:
  ```jsx
  {tasks.length === 0 && (
    <div className="empty-state">
      {readOnly
        ? 'No tasks match the current filters.'
        : 'No tasks yet. Click "New Task" to add one, or clear your filters.'}
    </div>
  )}
  ```
- Keep the columns rendering (headers + empty bodies) so the board structure stays stable.

### 3. MyTasksPage.jsx
- When the loaded tasks list is empty (after data loads, not during loading), render a friendly empty state: `"You have no assigned tasks yet."` with a subtle sub-message `"Tasks assigned to you will appear here."` in a centered muted block.

### 4. Styling (minimal)
- Add ONE shared `.empty-state` rule (put it in `frontend/src/index.css` so all three components pick it up):
  ```css
  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .empty-state .empty-hint { margin-top: 0.25rem; font-size: 0.8rem; opacity: 0.75; }
  ```
  Use `var(--text-muted)` so it follows the theme. Do not change any other token.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Frontend-only; no backend/db changes; no route changes.
- Keep the neon/cyberpunk theme and preserve all existing functionality (filters, drag-drop, sorting, counts).
- Must build cleanly: `cd /home/ubuntu/projects/glance/frontend && npm run build`.
- Report exactly what you changed.

## Deliverables
- Clear empty-state messaging in List, Kanban, and My Tasks when there are no tasks.
- Build passes.
- No regressions to filtering, drag-drop, sorting, or column rendering.
