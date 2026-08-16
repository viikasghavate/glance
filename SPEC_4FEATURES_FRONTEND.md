# Glance — Frontend for Global Search, Project Tags, Task Checklist, List Drag-Drop

The backend is DONE and committed locally. Now implement the FRONTEND for these features. Reference `SPEC_4FEATURES.md` for the full spec. Backend endpoints already exist:
- `GET /api/search?q=` → `{projects:[{id,name,color}], tasks:[{id,title,project_id,project_name,status}], comments:[{id,body,task_id,task_title,user_name}]}`
- Projects now have `tags` (comma-separated string).
- Checklist: `GET /api/tasks/:id/checklist`, `POST /api/tasks/:id/checklist` `{text}`, `PATCH /api/checklist/:itemId` `{text,completed}`, `DELETE /api/checklist/:itemId`, `POST /api/tasks/:id/checklist/reorder` `{orderedIds}`.
- Reorder: `POST /api/tasks/:id/reorder` `{status,position}` (already exists for list reordering).

## Frontend tasks

### 1. Global Search dropdown (frontend/src/components/Layout.jsx)
The top-bar search input should now call `/api/search?q=` (debounced ~300ms) and show a results dropdown:
- Grouped: Projects / Tasks / Comments.
- Project click → `/project/:id`.
- Task click → `/project/:project_id`.
- Comment click → `/project/:task's project_id`.
- Close on blur/escape/selection. Clear when input cleared. Empty state "No results".

### 2. Project Tags (frontend/src/components/ProjectModal.jsx + ProjectListPage.jsx)
- ProjectModal: add a "Tags" text input (comma-separated), save with project.
- ProjectListPage: show project tags as small badges on project cards (like labels).

### 3. Task Checklist (frontend/src/components/TaskDetailModal.jsx)
Add a "Checklist" section to the task detail modal:
- Add-item input + button.
- List items with checkbox (toggle completed via PATCH), text, delete button.
- Show progress "X/Y done".
- Reorder with up/down buttons (POST reorder with orderedIds).

### 4. List Drag-Drop (frontend/src/components/TaskList.jsx)
Make task rows draggable (HTML5 drag events) to reorder:
- dragstart/dragover/drop → compute new position → `POST /api/tasks/:id/reorder` with `{position}` → refresh.
- Disable for viewers (readOnly prop).
- Keep subtask indentation/filters working.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Backend is done — do not modify backend files unless strictly needed.
- Preserve the Neon Cyberpunk theme and all existing functionality.
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report what you changed.

## Deliverables
- Global search dropdown in top bar.
- Tags input + badges.
- Checklist UI in task detail.
- List drag-drop reordering.
- Build passes.
