# SPEC — My Tasks: Clear Filters button

## Objective
The My Tasks page (`frontend/src/pages/MyTasksPage.jsx`) now has nine independent
filter/sort states — `search`, `sortBy`, `sortDir`, `dueFilter`, `priorityFilter`,
`assigneeFilter`, `labelFilter`, `filterSprint`, `filterMilestone` — but no one-click
way to reset them all. Add a **"Clear filters"** button that appears in the toolbar
whenever any filter is active and resets every filter/sort state to its default.

**Frontend-only.** No backend change, no schema change, no new dependencies.

## Assumptions / current state (verified in repo, main branch)
- `MyTasksPage.jsx` holds these states (defaults): `search=''`, `sortBy=''`,
  `sortDir='asc'`, `dueFilter=''`, `priorityFilter=''`, `assigneeFilter=''`,
  `labelFilter=''`, `filterSprint=''`, `filterMilestone=''`.
- The toolbar is a row inside `.my-tasks-toolbar` (see `MyTasksPage.css`), currently ending
  with the milestone `<select>`. Existing select/input styling applies to toolbar controls.
- The page body already shows "No tasks match your filter." when `filtered.length === 0`
  while tasks exist — unchanged.

## Scope — touch ONLY
- `frontend/src/pages/MyTasksPage.jsx`
- `frontend/src/pages/MyTasksPage.css` (only if a new class is truly needed; reuse existing
  toolbar control styles first — e.g. reuse `.sort-toggle` or a plain toolbar button).

Do NOT touch backend, other pages/components, overdue.js, package.json. No drive-by refactor.

## Behavior
1. Compute an `anyFilter` boolean: true if any of the nine states differs from its default
   (search non-empty, sortBy set, sortDir !== 'asc', dueFilter set, priorityFilter set,
   assigneeFilter set, labelFilter set, filterSprint set, filterMilestone set).
2. If `anyFilter` is true, render a **"Clear filters"** button in the toolbar (place it at
   the end of the toolbar row, after the milestone `<select>`). When it is clicked, reset all
   nine states back to their defaults (search '' → clears the search box too).
3. When `anyFilter` is false, render nothing (button hidden) — toolbar layout stays clean.
   Do not render a permanently-disabled button.
4. The button is `<button type="button">` with text "Clear filters"; give it a small muted
   style and hover accent (reuse existing patterns; add a `.toolbar-clear` class in
   `MyTasksPage.css` only if needed, styled like the other toolbar controls).

## Constraints
- Only the My Tasks page toolbar is affected. The status chips (`filter`) are intentionally
  NOT reset by this button — they are a primary quick-switch control, separate from the
  refinement filters. (If the requirement to also clear the chip is preferred, that is a
  separate decision; default: leave chips untouched.)
- Sorting behavior preserved: resetting `sortDir` back to `'asc'` and `sortBy` to `''`
  restores backend default order, matching existing sort semantics.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean; backend boots with no errors.
2. With no filters set, no "Clear filters" button is shown.
3. Setting ANY filter (search text, a sort, a due value, a priority, an assignee, a label,
   a sprint, a milestone, or flipping sort direction) makes the button appear.
4. Clicking it resets the visible list to the unfiltered, backend-ordered set and clears
   the search box; the button disappears.
5. Existing status chips, search, sort, due/priority/assignee/label/sprint/milestone filters
   all still work individually and combined (no regression).
6. Verified against a COPY of the live DB (real tasks with varied labels/sprints/assignees).
