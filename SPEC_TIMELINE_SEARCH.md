# Glance — Search box on Timeline (Gantt) view

## Objective
Add a **client-side search box** to the Timeline (Gantt) view so users can quickly find
tasks by title, description, project, sprint, milestone, or label names — parity with the
List, Kanban, and My Tasks views, which already have search. Timeline currently has
label/priority/assignee/sprint/milestone/due filters + sort but **no text search**.

## Current state (verified)
- `frontend/src/components/TimelineView.jsx` renders a `.timeline-filters` div (line ~339)
  containing the filter `<select>`s + sort `<select>` + sort-toggle button. No `<input>`,
  no search state. `grep -c "search|<input"` returns 0.
- `filteredTasks = tasks.filter(...)` (line ~158) applies label/priority/assignee/sprint/
  milestone/due filters; results feed `groups` (a `useMemo`) which renders group headers +
  one row per task.
- Task objects carry: `title`, `description`, `project_name`, `sprint_name`, `milestone_name`,
  `labels` (comma-separated string), `labelList` (array of {id,name}). These are the fields
  the other views search against.
- CSS: `frontend/src/components/TimelineView.css` — `.timeline-filters` is `display:flex;
  gap:0.5rem; padding:0.75rem; border-bottom:1px solid var(--border)`. `select` has
  `width:auto; min-width:140px`. Follow the Neon theme tokens (var(--bg), var(--border),
  var(--text-muted), var(--cyan)).

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx`
- `frontend/src/components/TimelineView.css` (only if a new class is needed)

Do NOT touch backend, other components, task data logic, or other files. No schema change.

## Behavior
1. Add a search `<input>` (placeholder "Search tasks…") as the **first control** in
   `.timeline-filters`, before the Label select.
2. New state `search` (default `''`).
3. In `filteredTasks`, add an AND clause: match (case-insensitive, trimmed) against
   `title`, `description`, `project_name`, `sprint_name`, `milestone_name`, and label
   names (from `labelList` if present, else split `labels`). Empty query → no filtering.
   Combine AND with existing filters and sort.
4. Reuse existing CSS tokens; add a minimal style for the search input matching the
   select styling in `.timeline-filters` (same height/border/bg). Prefer a class like
   `timeline-search` or reuse an existing input style already used by sibling views
   (e.g. `.project-search` / search inputs in TaskList) if convenient — otherwise add a
   small `.timeline-filters input` rule.
5. Do NOT alter the single-row rendering, group headers, today line, weekend shading,
   subtask indentation, sticky-left column, or click-to-open behavior. Keep the deep-link
   `onTaskClick(task)` behavior.

## Success criteria
1. `cd frontend && npm run build` passes clean.
2. Typing in the search box narrows the Timeline to matching tasks (title/description/
   project/sprint/milestone/label); clearing restores the full list.
3. Search combines correctly with the label/priority/assignee/sprint/milestone/due
   filters and with sort (AND semantics).
4. When the query matches nothing, show the existing `timeline-empty` state
   ("No tasks match the filters.") — no crash.
5. No regression to the single-row alignment, sticky left column, grouping, or any
   other Timeline behavior.
6. Verified against a COPY of the live DB (real tasks with varied titles/labels) — no
   errors, no column/index issues.

## Constraints
- Do NOT edit backend files or `backend/db.js`. No destructive/DB-writing commands.
- Frontend-only. Match existing style/theme exactly. Keep changes minimal.
- Implement via the coding agent; do not hand-edit source files directly in review.
