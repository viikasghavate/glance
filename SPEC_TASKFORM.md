# Glance — Make Task Form Modal Wider

The task form modal (`TaskModal.jsx`) uses the global `.modal` class which has `max-width: 520px`. The task form has many fields (title, description, status, priority, start/due dates, assignee, reporter, labels, estimated hours, time spent, parent task, recurrence, recurrence end) so it's too narrow.

## Changes
1. In `frontend/src/components/TaskModal.jsx`, change the modal div to `className="modal task-form-modal"` (add a distinctive class).
2. In `frontend/src/index.css` (or a TaskModal.css), add:
   ```css
   .task-form-modal {
     max-width: 760px;
   }
   ```
   Make the task form comfortably wider (760-820px). Also ensure the internal layout uses the extra width well — the field grids (e.g. `gridTemplateColumns: '1fr 1fr'` inline styles) should naturally spread out. If there are 3-4 fields in a row, consider allowing them to fit.
3. Keep the ProjectModal and TaskDetailModal at their current widths (only the task FORM gets wider).
4. Keep the Neon Cyberpunk theme and functionality.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Minor JSX change (add class) + CSS.
- Preserve functionality and theme.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed.

## Deliverables
- Task form modal wider (760px+).
- Other modals unchanged.
- Build passes.
