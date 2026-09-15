# SPEC — Collapse All / Expand All subtask control (List + Kanban)

## Objective
Add a frontend "Collapse all" / "Expand all" toggle so users can quickly collapse every
expanded parent task's subtasks at once (or expand them all) in the **List** view and the
**Kanban** board. Today both views only allow collapsing/expanding one parent at a time
via the per-row `▶/▼` toggle. This closes that gap.

## Assumptions / current state (verified in repo)
- `frontend/src/components/TaskList.jsx` (`TaskList` component) and
  `frontend/src/components/KanbanBoard.jsx` (`KanbanBoard`) both render parent tasks with
  collapsible subtasks.
- Both keep collapse state in a local object `const [collapsed, setCollapsed] = useState({})`
  keyed by parent task id: `{ [parentId]: true }` means that parent is collapsed.
- Both already have `toggleCollapse(id)` that flips one parent:
  - `TaskList.jsx` (lines ~83-85)
  - `KanbanBoard.jsx` (lines ~37-39)
- The filtered tree is derived in a `useMemo` that reads `collapsed`:
  - `TaskList.jsx`: `flattenTree(tree)` dependency includes `collapsed` (line ~137).
  - `KanbanBoard.jsx`: `tree` memo depends on `collapsed` (line ~59).
- There is **no** existing collapse-all / expand-all control in either view.
- The app's design system uses existing CSS vars and small `btn-ghost btn-sm`-style
  buttons for compact toolbar controls. Both views already render a `.kanban-filters` /
  filter row of `<select>`s. Add the new control to those existing toolbar rows.

## Scope — touch ONLY these two files (plus their CSS only if needed)
- `frontend/src/components/TaskList.jsx`
- `frontend/src/components/KanbanBoard.jsx`
(and optionally their matching `.css` files if a small style addition is required —
prefer reusing existing classes like `btn-ghost btn-sm` / `.sort-toggle` so no new CSS
is needed.)

Do NOT touch any other file. No backend, no DB schema, no API change.

## Behavior
1. Add a small "Collapse all" / "Expand all" toggle button to the List view filter row
   (next to the existing Sort select) and to the Kanban filter row.
2. **Collapse all:** capture the set of parent task ids that currently have subtasks and
   set `collapsed` so every such parent is collapsed. A parent has subtasks when its
   flattened node reports `hasChildren` true (both views already render a subtask count /
   toggle only for those).
3. **Expand all:** reset `collapsed` to `{}` (all parents expanded).
4. The button label/icon should reflect current state in a sensible way — e.g. a single
   toggle that reads "Collapse all" and switches to "Expand all" after collapsing, or two
   separate small buttons (Collapse all ⌄ / Expand all ⌃). Pick whichever is cleanest, but
   the collapsed/expanded global state must stay in sync with per-row toggles (it is just an
   operation that rewrites/clears the existing `collapsed` map, so sync is automatic).
5. Collapse-all must operate on **current filter results** (the visible parent nodes), not
   hidden ones — deriving from the already-filtered tree is correct.
6. Preserve: existing filters, per-row `▶/▼` toggles, drag-drop, subtask indentation,
   count badges, and all existing behavior.

## Success criteria (verifiable)
1. `cd /home/ubuntu/projects/glance/frontend && npm run build` passes clean (no errors).
2. In the **List** view: clicking "Collapse all" collapses every expanded parent with
   subtasks; clicking "Expand all" expands them all; per-row toggles still work afterward
   and stay consistent with the collapse-all state.
3. Same behavior in the **Kanban** board.
4. No console errors; existing filters and drag-drop still function.
5. `git diff --stat` shows changes only in the two component files (plus optional CSS).

## Constraints
- Do NOT create/alter DB tables, indexes, migrations, or any backend file.
- Do not change the task data model, fetch ordering, or existing filter logic.
- Do not hand-edit source directly here — implement via the coding agent.
  Keep changes minimal and readable.

## Verification steps
- `cd frontend && npm run build` — must pass.
- Optional: run the dev server and confirm the control renders and collapses/expands.
