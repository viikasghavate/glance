# Glance — Fix List View Table Column Alignment (definitive)

The List view table (`TaskList.jsx` + `TaskList.css`) columns STILL don't align. Exact diagnostic (from browser):

- `tableLayout: fixed` IS applied.
- `tableWidth: 1156px`, wrap width: 1156px.
- Column 1 `<th>` renders at **324px** (28% of 1156).
- Column 1 `<td>` renders at **74px** (NOT 28% — it's the content width).

So with `table-layout: fixed` set and `th` having `width: 28%`, the header column is 324px but the body cell is 74px. The body cells are auto-sizing to content and NOT respecting the fixed column widths. This is the root cause of the misalignment (headers far right of their data).

## Why this happens
With CSS `table-layout: fixed`, column widths are normally determined by the first row (the header). But in this rendering, the `<td>` cells in `<tbody>` are ignoring the fixed widths and collapsing to content width. This can happen if the table structure or a wrapper (`.task-table-wrap` with `overflow-x: auto`) interferes, or if there's a CSS issue with how the widths propagate.

## Robust fix (pick one that reliably works)
1. **Restructure as CSS Grid** (most reliable): Replace the `<table>` in `TaskList.jsx` with a grid-based layout where the header row and body rows use the SAME grid-template-columns (explicit px or fr values). This guarantees header and body columns align perfectly. Keep it a table-like visual (borders, rows) but use `display: grid` on a wrapper with `grid-template-columns: 28% 16% 12% 10% 12% 10% 6% 6%` (or px values) applied to both header and body rows.
2. OR: set explicit **px** column widths on the `<colgroup>` or on the first `<tr>` cells, and ensure the table has a fixed `width` (e.g. `width: 100%` or a px min-width) so columns don't collapse.
3. OR: remove the `overflow-x: auto` wrapper's interference by giving the table a `min-width` matching the content.

Prefer **option 1 (CSS Grid)** — it's the most reliable way to align header and body columns regardless of content width.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- You may modify `TaskList.jsx` and `TaskList.css` as needed (structure + styles).
- Preserve all functionality (filters, status dropdowns, subtask indentation, click-to-open).
- Keep the futuristic theme.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build`.
- **Verify by inspecting the rendered table geometry**: header and body cells in each column must have matching left/width. Use a browser (Playwright) to confirm before finishing.
- Report exactly what you changed and confirm alignment.

## Deliverables
- List view header and body columns perfectly aligned.
- Build passes.
- Verified alignment (header left/width == body cell left/width per column).
