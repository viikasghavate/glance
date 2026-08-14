# Glance — Parent-Child Task Relationships (Subtasks)

Add the ability to create parent-child relationships between tasks (subtasks). A task can have a parent task, and a parent can have multiple children.

## Data model (backend/db.js)
- Add `parent_id INTEGER` column to `tasks` table (nullable, self-referencing FK → tasks.id, ON DELETE SET NULL).
- Add to CREATE TABLE (fresh installs) AND the `migrate()` helper (existing DBs, idempotent ALTER TABLE ADD COLUMN — same pattern as existing migrations).
- Prevent a task from being its own parent (validate in app code).

## Backend changes (backend/routes/tasks.js)
- **POST /project/:projectId** — accept optional `parent_id`. Validate the parent exists and belongs to the same project. Insert with parent_id.
- **PATCH /:id** — accept optional `parent_id` in the updatable fields. Validate: parent exists, same project, and is not the task itself or a descendant (prevent cycles).
- **GET /project/:projectId** — return tasks with their children. Include a `children` array on each task (or return all tasks and let frontend build the tree). Simplest: return all tasks flat, each with `parent_id`, and let the frontend group them. Also include `subtask_count` (number of direct children) per task.
- **DELETE /:id** — when deleting a task, set its children's `parent_id` to NULL (or delete children too — decide: set to NULL to avoid accidental data loss; document the choice).

## Frontend changes
- **TaskModal.jsx** — add a "Parent task" dropdown (optional) listing other tasks in the project (excluding the task itself and its descendants). Allow selecting a parent when creating/editing.
- **TaskList.jsx** — render subtasks nested/indented under their parent task. Show a small expand/collapse toggle for parents with children. Indent children.
- **KanbanBoard.jsx** — show subtasks as nested/indented cards under their parent (or show a subtask count badge on parent cards). Keep it clean — indent children under parent in the same column.
- **TaskDetailModal.jsx** — show the parent task and list of subtasks for the task. Allow adding/removing a parent.
- **TimelineView.jsx** — optionally show subtasks indented under parents (nice-to-have; keep simple if complex).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Use the existing idempotent migration pattern for the new `parent_id` column.
- Preserve all existing functionality (RBAC, views, etc.).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Verify backend boots with a fresh DB (migration runs).
- Report what you changed and any issues.

## Deliverables
- `parent_id` column added (CREATE + migration).
- Backend: parent_id in create/update, cycle prevention, subtask_count, children handling on delete.
- Frontend: parent dropdown in TaskModal, nested subtasks in TaskList/KanbanBoard, parent/subtask display in TaskDetailModal.
- Build passes; backend boots.
