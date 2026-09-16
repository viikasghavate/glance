# SPEC — Search Box on List & Kanban Views

## Objective
Add a client-side **search box** to the **List view** (`frontend/src/components/TaskList.jsx`)
and the **Board (Kanban) view** (`frontend/src/components/KanbanBoard.jsx`) so users can
quickly find tasks by title/description/project/sprint/milestone/labels — parity with the
Timeline and My Tasks views, which already have a search box.

**Frontend-only.** No backend change, no DB schema/migration change. No new dependencies.

## Assumptions (verified in repo, main branch)
- Timeline already implements search — copy its approach for consistency:
  - State: `const [search, setSearch] = useState('');`
  - Input in the filters row: `<input type="text" className="timeline-search" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />`
  - Haystack built once from `[t.title, t.description, t.project_name, t.sprint_name, t.milestone_name, ...labelNames].filter(v => v != null).join(' ').toLowerCase()` where `labelNames` comes from the task's label list; match with `haystack.includes(q)` where `q = search.trim().toLowerCase()`.
- List view (`TaskList.jsx`) filters tasks via `matchesFilter(t)` inside `flattenTree` (deps include all filter states via `useMemo([...filterDue, collapsed])`). Add text-search matching to `matchesFilter` and add `search` to the `useMemo` deps.
- Kanban view (`KanbanBoard.jsx`) filters tasks in `getTasks(status)` via a chain of `.filter(...)` calls. Add a text-search `.filter(...)` to that chain and add the `search` state.
- Both filter rows render selects under a `task-filters` (List) / `kanban-filters` (Kanban) container; add the search `<input>` as the FIRST control in each row.

## Scope
- `frontend/src/components/TaskList.jsx`: add `search` state, search `<input>` in the filter row, a `searchMatches(t)` helper matching the same fields as Timeline, wire into `matchesFilter`, add `search` to `useMemo` deps.
- `frontend/src/components/KanbanBoard.jsx`: add `search` state, search `<input>` in the filter row, a text-search filter in `getTasks`, wire into the existing chain + empty-state handling (`kanban-empty`/no-task messaging should mention filters when a search is active, mirroring the existing empty-state logic).
- Reuse the existing `timeline-search` CSS class for the input styling (or add an equivalent `.task-search`/`.kanban-search` class in the corresponding `.css` only if needed for layout; prefer reusing existing classes).
- Keep behavior identical to Timeline: case-insensitive substring match over title/description/project_name/sprint_name/milestone_name/labels.

**Out of scope:** backend, DB, sort interaction changes, debouncing, keyboard shortcuts.

## Success Criteria
1. `npm run build` in `frontend/` passes.
2. In List view, typing in the new search box narrows rows to tasks whose title/description/project/sprint/milestone/label matches (case-insensitive substring), combined with existing filters (AND).
3. In Kanban view, typing in the new search box filters cards the same way within each column; empty columns show existing empty state.
4. Clearing the search restores all tasks (no stale filtering).
5. Existing filters, sort, collapse-all still work unchanged.

## Constraints
- OpenCode coding agent makes the edits; do NOT hand-edit source.
- No new dependencies. Frontend-only.
- Match existing code style and existing CSS conventions.
