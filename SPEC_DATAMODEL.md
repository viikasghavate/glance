# Glance — Data Model Improvements (Highest Value)

Implement the top 3 high-value data model improvements:
1. Normalize `projects.tags` and `tasks.labels` (comma-separated strings) into proper join tables.
2. Add missing foreign keys and performance indexes.
3. Add a `task_status_history` table to power analytics trends and richer audit.

## Feature 1: Normalize tags & labels into join tables

### New tables (backend/db.js)
```sql
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS project_tags (
  project_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS task_labels (
  task_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  PRIMARY KEY (task_id, label_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
```

### Keep the existing `tags` / `labels` columns
Do NOT drop the existing comma-separated columns (the app still uses them). Instead, **sync**: whenever a project's `tags` or a task's `labels` is saved, also update the join tables (delete existing joins, re-insert for each tag/label). This keeps both representations consistent and enables new queries.

### Backend helpers (new `backend/services/tagging.js`)
- `syncProjectTags(projectId, tagsString)` — parse comma-separated, upsert tags, update project_tags.
- `syncTaskLabels(taskId, labelsString)` — parse, upsert labels, update task_labels.
- `getProjectTags(projectId)` → array of tag names.
- `getTaskLabels(taskId)` → array of label names.

### Wire into routes
- `backend/routes/projects.js`: after create/update, call `syncProjectTags`. In GET list/detail, include `tagList` (array of names).
- `backend/routes/tasks.js`: after create/update, call `syncTaskLabels`. In GET, include `labelList` (array of names).

### New query endpoints (optional but valuable)
- `GET /api/tags` → all tags with project counts.
- `GET /api/labels` → all labels with task counts.
- Add `?tag=` filter to `GET /api/projects` and `?label=` to `GET /api/tasks/project/:id`.

## Feature 2: Add missing foreign keys + indexes

### Missing FKs (SQLite limitation: can't ALTER ADD FK easily)
SQLite cannot add a FK to an existing table via ALTER TABLE. The cleanest approach: **recreate the tables with FKs** in the migration for `projects` and `tasks`:
- `projects.owner_id` → `REFERENCES users(id) ON DELETE SET NULL`
- `tasks.reporter_id` → `REFERENCES users(id) ON DELETE SET NULL`

To recreate safely (preserving data): in `migrate()`, detect if the column lacks a FK (check via `PRAGMA foreign_key_list(table)`), and if so, recreate the table using the standard SQLite 12-step ALTER (create new table, copy data, drop old, rename). This is complex — implement carefully with a transaction and preserve all data. If too risky, fall back to documenting the limitation and adding indexes only. **Prioritize correctness over completeness — do not lose data.**

### Indexes (add these via CREATE INDEX IF NOT EXISTS)
- `idx_projects_owner_id` on projects(owner_id)
- `idx_tasks_project_id` on tasks(project_id)
- `idx_tasks_status` on tasks(status)
- `idx_tasks_assignee_id` on tasks(assignee_id)
- `idx_tasks_parent_id` on tasks(parent_id)
- `idx_tasks_due_date` on tasks(due_date)
- `idx_comments_task_id` on comments(task_id)
- `idx_activity_entity` on activity_log(entity_type, entity_id)
- `idx_task_deps_task` on task_dependencies(task_id)
- `idx_task_checklist_task` on task_checklist(task_id)

## Feature 3: task_status_history table

### New table
```sql
CREATE TABLE IF NOT EXISTS task_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  user_id INTEGER,
  changed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### Wire into backend
- In `backend/routes/tasks.js`, when a task's status changes (via PATCH or the reorder/status endpoint), insert a row into `task_status_history` with the new status and the current user (req.user.id).
- Add `GET /api/tasks/:id/status-history` → ordered history for a task.

### Analytics integration (optional)
- Update `backend/routes/analytics.js` to optionally use status history for a "status change trend" (e.g. tasks moved to done per day over last 30 days). If time-consuming, skip and just provide the endpoint.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- **CRITICAL: do NOT lose data.** The migration must preserve all existing rows. For table recreation, use a transaction and copy all columns.
- Preserve all existing functionality (RBAC, views, subtasks, dependencies, recurring, activity, dashboard, search, checklist, etc.).
- The existing comma-separated `tags`/`labels` columns stay (synced to join tables) — don't remove them.
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and verify backend boots with a fresh DB and with a copy of an existing DB (migration preserves data).
- Report what you changed and any issues.

## Deliverables
- tags/labels + join tables, sync helpers, tagList/labelList in responses, tag/label endpoints & filters.
- Missing FKs (owner_id, reporter_id) via safe table recreation (or documented fallback) + all indexes.
- task_status_history table + status-change logging + GET endpoint.
- Build passes; backend boots; data preserved.
