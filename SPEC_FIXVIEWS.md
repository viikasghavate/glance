# Glance — Fix List View Header Alignment + Verify Timeline View

Two issues reported:

## Issue 1: List view table header misaligned
In the List view (`TaskList.jsx`), the table header row (Title, Labels, Status, Priority, Assignee, Due Date, Est. Hours, Spent) is **misaligned** — headers appear right-aligned / spaced far to the right, while the data columns below are left-aligned. The header columns don't line up with the body columns.

**Likely causes to investigate:**
- The `<th>` elements use `font-family: 'Orbitron'` (a wide geometric font) which may cause width/alignment issues.
- `table-layout` not set — the browser auto-layouts columns, and the wide Orbitron headers may push columns out of sync with the body.
- Check `frontend/src/components/TaskList.css` `.task-table` — consider adding `table-layout: fixed` with explicit column widths, OR remove Orbitron from `<th>` (use Space Grotesk / the body font) so headers align with body cells.
- Ensure `<th>` and `<td>` have identical padding and text-align (left).

**Fix:** Make the header columns align perfectly with the body columns. Prefer: set `table-layout: fixed` + explicit column widths (or `width: auto` with consistent padding), and/or change `<th>` font to match body font so widths are consistent. Verify visually.

## Issue 2: Timeline view "missing" on deployed site
The Timeline view code exists and renders correctly locally (verified). But the user reports it's missing on the deployed site. Investigate:
- Confirm the Timeline toggle button renders and `view === 'timeline'` triggers `TimelineView` in `ProjectDetailPage.jsx`.
- Check if there's a build/routing issue where the Timeline button or view isn't showing.
- If the code is correct, the issue may be browser cache on the user's side — but double-check the toggle and rendering logic for any bug (e.g. the toggle button not visible, or the view not switching).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Fix the list header alignment (CSS/JSX in TaskList).
- Verify/fix the Timeline view rendering.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed and the root cause of each issue.

## Deliverables
- List view header aligned with body columns.
- Timeline view confirmed working (or fixed).
- Build passes.
