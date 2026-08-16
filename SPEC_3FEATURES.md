# Glance — Add Activity Feed, Task Dependencies, and Recurring Tasks

Add three features: Activity Feed/Audit Log (#2), Task Dependencies (#5), and Recurring Tasks (#7).

## Feature 1: Activity Feed / Audit Log

### Data model (backend/db.js)
New table `activity_log`:
```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,          -- e.g. 'task.created', 'task.status_changed', 'task.assigned', 'comment.added', 'project.created', 'user.role_changed'
  entity_type TEXT NOT NULL,      -- 'project' | 'task' | 'comment' | 'user'
  entity_id INTEGER,
  entity_name TEXT,
  details TEXT,                   -- JSON string with extra info (e.g. old/new status)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```
Add a helper `logActivity(userId, action, entityType, entityId, entityName, details)` in a new `backend/services/activity.js` (or inline in db.js). Call it from:
- tasks.js: on create, update (status change, assignee change, title/priority/dates change), delete, reorder, comment added.
- projects.js: on create, update, delete.
- comments.js: on comment create/delete.
- users.js: on role change, user create/delete.
Details JSON should capture the change (e.g. `{"from":"todo","to":"in_progress"}`).

### Backend
- New `GET /api/activity` (authenticated) in `backend/routes/activity.js` (mounted at /api/activity in server.js). Optional query params: `project_id`, `entity_type`, `limit` (default 50). Returns activity rows joined with user name. Newest first.
- Include the user's `name` in the response (JOIN users).

### Frontend
- Dashboard: add a "Recent Activity" section using `/api/activity` (replace or augment the existing recentActivity which only shows tasks).
- New activity page or view (optional but nice): a fuller activity log. At minimum, show activity on the dashboard.
- Format each activity item: `[User] did [action] on [entity]` with relative time (e.g. "Admin moved 'Assess version' to Done · 2h ago").

## Feature 2: Task Dependencies

### Data model
New table `task_dependencies`:
```sql
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,        -- the task that is BLOCKED
  depends_on_id INTEGER NOT NULL,  -- the task it DEPENDS ON (blocking task)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_id)
);
```
This means: task_id depends on depends_on_id (task_id is blocked by depends_on_id).

### Backend (backend/routes/tasks.js)
- On GET tasks (project), include for each task: `blockedBy` (array of {id, title} of tasks it depends on) and `blocks` (array of {id, title} of tasks that depend on it).
- New endpoints:
  - `POST /api/tasks/:id/dependencies` — body `{depends_on_id}`. Validate: both tasks exist, same project, not the task itself, no cycle (task A depends on B and B depends on A, or longer cycles). Insert.
  - `DELETE /api/tasks/:id/dependencies/:dependsOnId` — remove a dependency.
  - `DELETE /api/tasks/:id/dependencies` — remove all (optional).
- Cycle detection: before adding, ensure depends_on_id is not already a task that (transitively) depends on task_id.

### Frontend
- TaskDetailModal: show "Blocked by" and "Blocks" lists. Allow adding/removing a dependency (select from project tasks, exclude self + existing + those that would create a cycle).
- KanbanBoard / TaskList / Timeline: show a small "blocked" indicator (e.g. ⛔ or a red border/icon) on tasks that have dependencies not yet done.
- Keep it clean — a subtle blocked badge/icon.

## Feature 3: Recurring Tasks

### Data model (backend/db.js)
Add to tasks table (CREATE + migration):
- `recurrence TEXT NOT NULL DEFAULT 'none'` — none | daily | weekly | monthly | yearly
- `recurrence_end TEXT` — optional end date for recurrence

### Backend (backend/routes/tasks.js)
- POST/PATCH: accept `recurrence` and `recurrence_end`.
- When a recurring task's status is set to 'done' (via PATCH or the reorder endpoint or status change), auto-create the next occurrence:
  - Compute next due_date based on recurrence (daily +1d, weekly +7d, monthly +1 month, yearly +1 year) from the current due_date (or created_at if no due_date).
  - Create a new task with same project, title, description, priority, labels, assignee, reporter, parent_id, recurrence, recurrence_end, and the computed due_date/start_date. Set status to 'todo', position at end.
  - Copy dependencies and parent-child as appropriate (new task inherits parent_id and dependencies).
  - If recurrence_end is set and the next occurrence would be after it, do not create (and the original task just becomes done).
- Mark the original task done (do not re-create on every done toggle — only create the next once; track via a flag if needed, but simplest: only create next occurrence when the task transitions to done from a non-done status).

### Frontend
- TaskModal: add a "Recurrence" select (None/Daily/Weekly/Monthly/Yearly) + optional end date.
- TaskDetailModal / TaskList / Kanban: show a small recurrence badge (e.g. ↻ Daily) on recurring tasks.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Use the existing idempotent migration pattern for new columns/tables.
- Preserve all existing functionality (RBAC, views, subtasks, dashboard, etc.).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Verify backend boots with a fresh DB (migrations run).
- Report what you changed and any issues.

## Deliverables
- activity_log table + logging on key actions + GET /api/activity + dashboard Recent Activity.
- task_dependencies table + dependency CRUD with cycle prevention + blocked-by/blocks in task data + frontend indicators.
- recurrence columns + auto-create next occurrence + TaskModal recurrence selector + badges.
- Build passes; backend boots.
