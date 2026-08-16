# Glance — Fix List View Table Column Alignment (headers vs body)

The List view table (`TaskList.jsx` + `TaskList.css`) still has misaligned columns. Diagnostic data from the rendered page:

- **tableWidth:** 1156px, wrapWidth: 1156px
- **Headers (th):** Title left=320 w=324, Labels left=644 w=185, Status left=829 w=139, Priority left=967 w=116, Assignee left=1083 w=139, Due Date left=1222 w=116, Est. Hours left=1337 w=69, Spent left=1407 w=69
- **First row body cells (td):** td0 left=333 w=74, td1 left=407 w=30, td2 left=437 w=126, td3 left=563 w=65, td4 left=628 w=30, td5 left=658 w=62, td6 left=720 w=30, td7 left=750 w=40

**Problem:** The header row spans the full 1156px width (using the percentage widths), but the body cells are clustered in the first ~450px (auto-sizing to content). The header and body columns do NOT align — headers are far right of their data.

**Root cause hypothesis:** `table-layout: fixed` was added to `.task-table` with percentage widths on `th`, but the body `<td>` cells are not respecting the fixed column widths — they're auto-sizing to content and clustering left. This can happen if:
- The `table-layout: fixed` rule isn't actually applying (specificity/order issue), OR
- The `<td>` cells have their own width/padding that overrides, OR
- The table is inside `.task-table-wrap` (overflow-x: auto) and something is off.

**Fix requirements:**
Make the header columns and body columns align perfectly. The most robust approach:
1. Ensure `table-layout: fixed` is definitely applied to `.task-table` (check specificity — it may be overridden).
2. Apply the SAME explicit column widths to both `th` AND `td` (e.g. `th:nth-child(n), td:nth-child(n) { width: X% }`), so body cells use the same widths as headers.
3. OR remove the percentage widths and let the table auto-layout naturally (remove `table-layout: fixed`), ensuring headers and body use the same font/padding so they align.
4. Ensure `th` and `td` have identical `padding` and `text-align: left`.
5. Verify the fix renders correctly (headers align with body cells).

Prefer the approach that reliably aligns columns. Test by inspecting the rendered table geometry (header left/width vs body cell left/width should match per column).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Fix `frontend/src/components/TaskList.css` (and TaskList.jsx only if needed).
- Preserve the futuristic theme and functionality.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed and confirm the columns now align.

## Deliverables
- List view header and body columns aligned.
- Build passes.
