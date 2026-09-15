# Glance — Fix Timeline (Gantt) Bar/Row Alignment (deploy run)

## Objective
Make the TimelineView (MS Project-style Gantt) left task-name rows and right bar rows **perfectly vertically aligned** so each colored bar sits on the same vertical line as its task name. Currently the left panel and right panel are separate flex/container stacks whose row heights can drift out of sync (padding/meta-line differences, group-header spacers), so bars appear shifted up/down relative to their task names.

## Assumptions / current state
- File: `frontend/src/components/TimelineView.jsx` + `frontend/src/components/TimelineView.css`.
- The component renders a fixed `timeline-left-col` (task names, `.timeline-row-left`, `.timeline-group-header-left-cell`) and a scrollable `timeline-right-col` (`.timeline-row-right`, `.timeline-group-header-right-cell`, bars `.timeline-bar`).
- Groups are built in a `useMemo` producing `{ label, tasks }[]`. Each group renders one header row then one row per task, in BOTH columns with identical ordering (same `groups.map`). CSS currently gives `.timeline-row-left` and `.timeline-row-right` both `min-height: 40px` and group-header cells both `height/min-height: 32px`, but alignment still drifts because the two columns are independent stacks that can diverge (e.g. if a row in one column wraps to a taller height, the other column's matching row doesn't grow).
- No backend or DB change. No schema. Read-only rendering component.

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx`
- `frontend/src/components/TimelineView.css`

Do NOT touch any other file.

## Solution (preferred: single-row rendering)
Restructure so each task is rendered as ONE row that contains BOTH the task-name cell and the bar cell, so the name and bar can never drift apart.

Concretely:
1. Keep header/date header as-is at top (left "Task" title + right month/day headers). Keep the today line and month/day header behavior.
2. Render one row per task spanning the full timeline width (left name area + right bar area) inside a single container, using CSS to give the name a fixed-width left segment (e.g. 320px, matching the current `leftWidth = 320`) and the bar area the remaining width. The bar is absolutely/relatively positioned within the bar segment using the existing `getBarStyle(task)` offsets.
3. Group headers must span the same full width and occupy identical vertical space consistently (one header row per group, same height) so tasks stay in sync.
4. Preserve: grouping + sort order, TODAY line, month/day header, weekend shading, task color by status, click-to-open (`onTaskClick`), subtask depth indentation, the fixed-left name column that stays while the right side scrolls horizontally (sticky/fixed left column).

Implementation guidance (you may choose the exact mechanism, but it must guarantee name/bar alignment):
- Render the header rows and each group (header + its task rows) ONCE, each row being a flex/grid with `grid-template-columns: 320px 1fr` (or `320px` + flexible). Put the name content in the first cell and the bar in the second cell of the SAME row. Put the today-line and month/day headers above the rows (fixed/sticky) matching the same horizontal offsets.
- The right bar segment contains a relative container of width = `timelineWidth` so `getBarStyle`'s `left`/`width` (dayWidth-based) still apply unchanged.
- Keep `.timeline-row-left`/`.timeline-row-right` concepts but fold them into one `.timeline-row` with a left and right segment; keep the existing class hooks used by subtask indentation (`.timeline-row-left.subtask-row .timeline-task-name` etc.) or adapt them equivalently.
- Ensure horizontal scroll still works on the bar area (keep the outer `.timeline-scroll` with the inner width = leftWidth + timelineWidth), and the left name column stays visually fixed while the right part scrolls (may keep sticky left or make the whole row scroll together — the spec's priority is vertical alignment between name and bar, so if making the name column sticky complicates things, keeping both scrolling together horizontally is acceptable, but the today-line/month headers must line up with the day grid).

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean (no errors).
2. Visual/logic check: for every task with start+due dates, the bar's vertical position matches its task-name row exactly (no top/bottom drift). Group header heights are consistent so rows after each group stay aligned.
3. Today line, month/day headers, weekend shading, status colors, subtask indentation, and click-to-open still work.
4. No console errors in the browser timeline view.

## Constraints
- Do NOT create/alter DB tables, indexes, or migrations. No backend changes.
- Do not change the task data model or task-fetch ordering.
- Preserve the existing MS Project Gantt look (grouping, colors, today line, date header).
- Do not hand-edit source directly here — implement via the coding agent. Keep changes minimal and readable; do not rewrite unrelated parts of the file.

## Verification
- `node --check` is not relevant (frontend JSX). Use `cd frontend && npm run build`.
- Optionally inspect the built bundle or run the dev server to confirm the single-row structure renders without errors.
