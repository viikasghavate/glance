# Glance — Minor Polish on Futuristic Theme

Apply small polish fixes to the Neon Cyberpunk theme. These were flagged in a visual review. CSS-only changes.

## Fixes

### 1. Standardize primary button glow
Currently the Login button has a strong glowing gradient, but "New Project" / "New Task" buttons use a flatter cyan style. Make all primary buttons consistent:
- `.btn-primary` (and any primary action buttons like "New Project", "New Task", "Login", "Save", "Create") should share the same cyan→violet gradient background + consistent glow (box-shadow).
- Ensure the glow is consistent in intensity across all primary buttons (not stronger on login than others).
- Check `frontend/src/index.css` (`.btn-primary`) and any component-specific primary button styles (LoginPage.css, ProjectListPage.css, ProjectDetailPage.css, modals) and unify them.

### 2. Kanban column padding
In the Kanban board, the "To Do" and "Done" columns have very tight margin between the cards and the container edge. Add comfortable padding:
- `frontend/src/components/KanbanBoard.css` — increase column padding (e.g. `padding: 0.75rem` → `1rem` or more) and ensure cards have consistent spacing from the column edges.

### 3. (Optional) Timeline date readability
The date numbers in the Timeline view header are small. Slightly increase their size / contrast for readability:
- `frontend/src/components/TimelineView.css` — bump the date cell font-size and/or color contrast.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- CSS-only changes. No JSX/backend changes.
- Preserve the futuristic theme and all functionality.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed.

## Deliverables
- Consistent primary button glow.
- Comfortable kanban column padding.
- (Optional) more readable timeline dates.
- Build passes.
