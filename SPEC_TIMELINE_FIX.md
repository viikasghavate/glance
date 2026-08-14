# Glance — Fix Timeline (Gantt) Bar/Row Alignment

The new TimelineView (MS Project-style Gantt) has a **vertical alignment bug**: the colored bars in the right timeline panel do NOT align with their corresponding task names in the left panel. Bars appear shifted down relative to their task rows (e.g. "Assess requirements" bar appears below its name, "Backup data" bar appears far right/misaligned).

## Root cause (likely)
The left task panel and the right timeline panel are rendered as separate lists/containers, so their row heights don't match. Common causes:
- Different padding/margins on rows in the two panels.
- The left panel rows and right panel rows have different heights (e.g. one has extra padding, a badge, or a sub-line that the other doesn't).
- Group headers (phase labels) in the left panel don't have matching spacer rows in the right panel, so rows drift out of sync after each group.

## Fix requirements
Make the left task rows and right timeline rows **perfectly aligned** so each bar sits on the same vertical line as its task name. Approaches:
1. **Single-row rendering**: render each task as ONE row that contains both the task name cell AND the bar cell (a grid/flex row), so they can't drift. This is the most robust fix.
2. OR ensure identical row heights in both panels AND identical group-header spacer heights, so they stay in sync.
3. Ensure group headers (phase labels) occupy the same vertical space in both panels (or span both panels as a full-width header).

Prefer approach 1 (single row per task with both name + bar) for reliability. Keep the MS Project look: left name column, right timeline with date columns, colored bars, today line, month/day header.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Only modify `frontend/src/components/TimelineView.jsx` and `TimelineView.css`.
- Preserve the existing look (grouping, colors, today line, date header).
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed.

## Deliverables
- Bars vertically aligned with their task names (no drift).
- Build passes.
