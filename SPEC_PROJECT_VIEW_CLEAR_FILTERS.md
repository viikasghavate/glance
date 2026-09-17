# SPEC — Clear filters button in project Board / List / Timeline toolbars

## Objective
Add a one-click **"Clear filters"** button to the three project-view toolbars (Board, List, Timeline) that appears only when at least one filter/search/sort control is non-default, and resets every one of them back to its default. This closes a parity gap: `MyTasksPage` already has exactly this affordance (`toolbar-clear`), while the three in-project views force the user to clear up to 8 controls by hand.

## Current state
- `frontend/src/pages/MyTasksPage.jsx` already implements the pattern: `anyFilter` boolean (lines ~51-61), `clearFilters()` (lines ~63-74), and the conditional button (lines ~342-346) with `className="toolbar-clear"`. Its CSS lives in `frontend/src/pages/MyTasksPage.css` scoped as `.my-tasks-toolbar .toolbar-clear` (lines ~51-67).
- The three project views each declare their own filter state and render their own toolbar:
  - `frontend/src/components/TaskList.jsx` — toolbar `<div className="task-filters">`; state: `filterStatus, filterPriority, filterAssignee, filterLabel, filterSprint, filterMilestone, filterDue, search, sortBy, sortDir`. CSS owner: `TaskList.css`.
  - `frontend/src/components/KanbanBoard.jsx` — toolbar `<div className="kanban-filters">`; state: `filterLabel, filterPriority, filterAssignee, filterSprint, filterMilestone, filterDue, search, sortBy, sortDir` (no `filterStatus` — the columns ARE statuses). CSS owner: `KanbanBoard.css`.
  - `frontend/src/components/TimelineView.jsx` — toolbar `<div className="timeline-filters">`; state: `filterLabel, filterPriority, filterAssignee, filterSprint, filterMilestone, filterDue, search, sortBy, sortDir` (no `filterStatus`). CSS owner: `TimelineView.css`.
- Each of the three toolbars already ends with the same tail: the `sort-toggle` button, then `collapseAll` / `expandAll` buttons in TaskList and KanbanBoard (TimelineView ends after `sort-toggle`).
- Defaults for every one of these controls are the empty string `''`, except `sortDir` whose default is `'asc'`.
- Each component owns its own `.sort-toggle` CSS block in its own stylesheet (duplicated three times), so there is no shared filter-toolbar stylesheet to edit — each component's CSS must carry its own `.toolbar-clear` rule.

## Assumptions
- Reset semantics: every filter/search/sort control returns to its default (`''`, and `sortDir` to `'asc'`). This matches `MyTasksPage.clearFilters()` exactly.
- Visibility semantics: the button is rendered only when `anyFilter` is true, matching `MyTasksPage` (avoids a dead control in the default state).
- Visual language: reuse the existing `toolbar-clear` styling convention (translucent panel background, `var(--border)`, muted text, cyan border on hover) so the new buttons look identical to the My Tasks one. Because `MyTasksPage.css` scopes its rule to `.my-tasks-toolbar`, the three project views need their own equivalent rule in their own stylesheets.
- No backend, no DB, no API changes — this is purely a client-side state reset.

## Scope — touch ONLY these files
- `frontend/src/components/TaskList.jsx`
- `frontend/src/components/TaskList.css`
- `frontend/src/components/KanbanBoard.jsx`
- `frontend/src/components/KanbanBoard.css`
- `frontend/src/components/TimelineView.jsx`
- `frontend/src/components/TimelineView.css`

Do NOT touch `MyTasksPage.jsx` / `MyTasksPage.css`, `ProjectDetailPage.jsx`, any backend file, or any other component.

## Implementation

### 1. `TaskList.jsx`
- Add an `anyFilter` boolean derived from state (mirror `MyTasksPage`):
  ```js
  const anyFilter =
    search !== '' ||
    sortBy !== '' ||
    sortDir !== 'asc' ||
    filterStatus !== '' ||
    filterPriority !== '' ||
    filterAssignee !== '' ||
    filterLabel !== '' ||
    filterSprint !== '' ||
    filterMilestone !== '' ||
    filterDue !== '';
  ```
- Add a `clearFilters` function that calls every setter back to its default:
  `setSearch(''); setSortBy(''); setSortDir('asc'); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setFilterLabel(''); setFilterSprint(''); setFilterMilestone(''); setFilterDue('');`
- In the `.task-filters` toolbar, immediately after the `sort-toggle` button (before the `collapseAll` button), render:
  ```jsx
  {anyFilter && (
    <button type="button" className="toolbar-clear" onClick={clearFilters}>
      Clear filters
    </button>
  )}
  ```

### 2. `KanbanBoard.jsx`
- Same pattern, but **without** `filterStatus` (that state does not exist here). `anyFilter` covers `search, sortBy, sortDir, filterLabel, filterPriority, filterAssignee, filterSprint, filterMilestone, filterDue`.
- `clearFilters` resets exactly those to defaults (`sortDir` → `'asc'`, all others → `''`).
- Render the button in `.kanban-filters` immediately after the `sort-toggle` button, before `collapseAll`.

### 3. `TimelineView.jsx`
- Same pattern as KanbanBoard (no `filterStatus`). `clearFilters` resets `search, sortBy, sortDir, filterLabel, filterPriority, filterAssignee, filterSprint, filterMilestone, filterDue`.
- Render the button in `.timeline-filters` immediately after the `sort-toggle` button (this toolbar has no collapse buttons — the button goes last).

### 4. CSS — one rule per stylesheet
In **each** of `TaskList.css`, `KanbanBoard.css`, `TimelineView.css`, add a `.toolbar-clear` rule mirroring the existing My Tasks styling, scoped to that component's toolbar wrapper. Use the component's actual wrapper class:
- `TaskList.css` → `.task-filters .toolbar-clear` (+ `:hover`)
- `KanbanBoard.css` → `.kanban-filters .toolbar-clear` (+ `:hover`)
- `TimelineView.css` → `.timeline-filters .toolbar-clear` (+ `:hover`)

Base declarations (match `MyTasksPage.css`):
```css
padding: 0.375rem 0.75rem;
border-radius: 0.5rem;
border: 1px solid var(--border);
background: rgba(20, 26, 40, 0.5);
color: var(--text-muted);
font-size: 0.75rem;
font-weight: 600;
cursor: pointer;
transition: border-color 0.15s, color 0.15s;
```
Hover: `border-color: var(--cyan); color: var(--text);`

Add `align-self: center;` or equivalent only if needed to align with the adjacent selects/buttons in that toolbar.

## Constraints
- React 18 + Vite, plain JSX, no new dependencies, no new shared files, no TypeScript.
- Keep every existing control, handler, and default value exactly as-is; this change only ADDS a reset affordance.
- Do not reorder, remove, or restyle any existing toolbar element.
- Follow the existing code style in each file (2-space indent, arrow handlers, double quotes avoided in JSX text).
- The `Clear filters` label text must be exactly `Clear filters` (so it is verifiable in the built bundle).

## Success criteria
1. `cd frontend && npm run build` exits 0 with no new warnings.
2. In Board, List, and Timeline views: with all controls at defaults, no "Clear filters" button is visible.
3. After changing any one control in any of the three toolbars, the "Clear filters" button appears.
4. Clicking it resets every control back to its default: search emptied, every `All …` select back to its placeholder option, `Sort by: None` reselected, sort direction back to ascending (`↑`), and the button itself disappears.
5. Clicking it also restores the full task set that was hidden by the filters (the view re-renders all tasks).
6. The button renders with the same visual treatment as the My Tasks "Clear filters" button (translucent panel, muted text, cyan border on hover).
7. No regressions: filters, sort, collapse/expand, drag-and-drop reorder, and task click still work in all three views.
8. `MyTasksPage` and `ProjectDetailPage` behavior is unchanged.
