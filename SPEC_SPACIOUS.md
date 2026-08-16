# Glance — Make Task Detail Window More Spacious

The task detail modal (`TaskDetailModal`) feels cramped. Make it more spacious and comfortable.

## Current (frontend/src/components/TaskDetailModal.css)
- `.task-detail-modal { max-width: 600px; }` — too narrow for all the content (relations grid, checklist, comments).
- The modal inherits global `.modal` padding (1.5rem).
- Sections (relations, checklist, comments) have modest margins.
- `.comments-list` max-height 300px, `.checklist-list` max-height 200px, `.subtask-list` max-height 120px.

## Changes
1. **Widen the modal**: `.task-detail-modal { max-width: 800px; }` (or ~760-820px). Make it comfortably wide.
2. **More padding**: increase the modal's internal padding (the global `.modal` uses 1.5rem — add a rule on `.task-detail-modal` to bump to ~2rem, or increase specific sections).
3. **More breathing room**:
   - Increase `.task-detail-header` margin-bottom (e.g. 0.75rem → 1.25rem).
   - Increase `.task-detail-meta` margin-bottom and gap.
   - Increase spacing between sections (relations, description, checklist, comments) — bump section margins/paddings.
   - `.task-detail-relations` gap 1rem → 1.25rem, grid columns could stay 2 but give more room.
4. **Taller content areas** (so less scrolling feels cramped):
   - `.comments-list` max-height 300px → 360px.
   - `.checklist-list` max-height 200px → 240px.
   - `.subtask-list` max-height 120px → 160px.
5. Keep the Neon Cyberpunk theme and all functionality. Keep the modal scrollable (max-height 90vh) so tall content still works.
6. Also apply the same spaciousness to the base `.modal` in `frontend/src/index.css` if it helps (e.g. increase padding to 1.75-2rem) — but keep other modals (Project/Task) looking good too.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- CSS-only changes (TaskDetailModal.css, maybe index.css).
- Preserve functionality and theme.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed.

## Deliverables
- Task detail window more spacious (wider, more padding, more breathing room).
- Build passes.
