# Glance — Add Global Search, Project Tags, Task Checklist, and List Drag-Drop

Add four features: Global Search (#1), Project Tags (#5), Task Checklist (#6), and List View Drag-and-Drop Ordering (#7).

## Feature 1: Global Search

### Backend
- New `GET /api/search?q=<query>` in `backend/routes/search.js` (mounted at /api/search in server.js), authenticated.
- Search across:
  - **Projects**: name, description (LIKE %q%)
  - **Tasks**: title, description, labels (LIKE %q%)
  - **Comments**: body (LIKE %q%)
- Return grouped: `{ projects: [{id, name, color}], tasks: [{id, title, project_id, project_name, status}], comments: [{id, body, task_id, task_title, user_name}] }`. Limit each group to ~10. Case-insensitive.
- If `q` is empty/too short (< 2 chars), return empty groups.

### Frontend
- In `Layout.jsx` top bar, the existing search input should call `/api/search` (debounced ~300ms) as the user types and show a **results dropdown** below the input with grouped results:
  - Projects → click navigates to `/project/:id`.
  - Tasks → click navigates to `/project/:project_id` and opens the task (or just navigates to the project).
  - Comments → click navigates to the task's project.
- Close dropdown on blur/escape/selection.
- Keep the existing behavior of filtering the project list in the sidebar (that can stay, but the top-bar search becomes global).

## Feature 5: Project Tags

### Data model (backend/db.js)
- Add `tags TEXT DEFAULT ''` to projects (comma-separated tags, like task labels). CREATE + migration.

### Backend (backend/routes/projects.js)
- POST/PATCH: accept `tags`.
- GET: include `tags` in project objects.

### Frontend
- `ProjectModal.jsx`: add a "Tags" text input (comma-separated).
- `ProjectListPage.jsx`: show tags as small badges on project cards.

## Feature 6: Task Checklist

### Data model (backend/db.js)
New table:
```sql
CREATE TABLE IF NOT EXISTS task_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

### Backend (backend/routes/tasks.js or new checklist routes)
- `GET /api/tasks/:id/checklist` — list checklist items for a task (ordered by position).
- `POST /api/tasks/:id/checklist` — add item `{text}`.
- `PATCH /api/checklist/:itemId` — update `{text}` and/or `{completed}`.
- `DELETE /api/checklist/:itemId` — remove item.
- `POST /api/tasks/:id/checklist/reorder` — `{orderedIds: [...]}` to reorder.
- Include checklist progress in task detail (count of completed/total).

### Frontend
- `TaskDetailModal.jsx`: add a "Checklist" section:
  - Add item input + button.
  - List items with a checkbox (toggle completed), text, delete button.
  - Show progress (e.g. "2/5 done").
  - Allow reordering (drag or up/down buttons — keep simple: up/down buttons).

## Feature 7: List View Drag-and-Drop Ordering

### Backend
- Reuse the existing `POST /api/tasks/:id/reorder` endpoint (body `{status, position}`) for reordering within the list. Verify it works for list ordering.

### Frontend
- `TaskList.jsx`: make task rows **draggable** to reorder (HTML5 drag events, like the kanban).
  - Drag a row up/down, drop to reorder.
  - On drop, call the reorder endpoint with the new position, then refresh.
  - Disable drag for viewers.
- Keep subtask indentation and filters working. Reordering should respect the current filtered order.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Use the existing idempotent migration pattern for new columns/tables.
- Preserve all existing functionality (RBAC, views, subtasks, dependencies, recurring, activity, dashboard, etc.).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Verify backend boots with a fresh DB (migrations run).
- Report what you changed and any issues.

## Deliverables
- /api/search endpoint + global search dropdown in top bar.
- projects.tags column + tags input/badges.
- task_checklist table + checklist CRUD + checklist UI in task detail.
- List view drag-and-drop reordering.
- Build passes; backend boots.
