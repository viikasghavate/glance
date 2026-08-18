# Glance — Remaining Data Model Improvements

Implement the remaining data model improvements. The highest-value ones (tags/labels normalization, FKs/indexes, status history) are already done. This covers: time tracking entries, attachments, watchers, notifications, soft-delete consistency, versioned migrations, and schema validation.

## 1. Time tracking entries
New table:
```sql
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER,
  started_at TEXT,
  ended_at TEXT,
  minutes INTEGER DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```
- Endpoints in `backend/routes/tasks.js` (or new `time_entries.js` mounted at /api/time):
  - `GET /api/tasks/:id/time-entries` — list for a task.
  - `POST /api/tasks/:id/time-entries` — add `{minutes, note, started_at?, ended_at?}`.
  - `DELETE /api/time/:id` — remove an entry.
  - `GET /api/time` — optionally: all time entries (for analytics).
- Keep `tasks.time_spent` as a denormalized total but **recompute it** from time_entries when an entry is added/deleted (sum minutes / 60). Update the task's `time_spent` accordingly.

## 2. Attachments
New table:
```sql
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  mime_type TEXT,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
```
- File storage: store uploads on disk under `/data/uploads/` (or `DB_PATH`-adjacent `uploads/` dir). Create the dir on boot.
- Endpoints (new `backend/routes/attachments.js` mounted at /api/attachments):
  - `POST /api/tasks/:id/attachments` — multipart upload (use `multer` — add dependency). Save file, insert row.
  - `GET /api/tasks/:id/attachments` — list attachments.
  - `GET /api/attachments/:id/download` — download the file.
  - `DELETE /api/attachments/:id` — remove.
- Note: multer is a new dependency — add to `backend/package.json` (`npm install multer`). If multer can't be added for any reason, implement a minimal base64/JSON upload instead.

## 3. Watchers
New table:
```sql
CREATE TABLE IF NOT EXISTS task_watchers (
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```
- Endpoints:
  - `POST /api/tasks/:id/watchers` — add current user as watcher.
  - `DELETE /api/tasks/:id/watchers` — remove current user.
  - `GET /api/tasks/:id/watchers` — list watchers.
  - Include `watchers` (array of user names) in task detail responses.

## 4. Notifications
New table:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,          -- 'task_assigned' | 'comment_added' | 'mention' | 'due_soon' | 'dependency_done' | ...
  title TEXT,
  body TEXT,
  payload TEXT,                -- JSON (task_id, project_id, etc.)
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```
- Create notifications in relevant places:
  - Task assigned to a user → notify that user (`task_assigned`).
  - Comment added to a task → notify the assignee + watchers (`comment_added`).
  - Dependency done → notify tasks blocked by it (`dependency_done`).
- Endpoints (new `backend/routes/notifications.js` mounted at /api/notifications):
  - `GET /api/notifications` — current user's notifications (newest first, limit 50).
  - `GET /api/notifications/unread-count` — count of unread.
  - `POST /api/notifications/:id/read` — mark one read.
  - `POST /api/notifications/read-all` — mark all read.

## 5. Soft-delete consistency
- Add `deleted_at TEXT` column to `tasks` and `projects` (nullable). 
- `archived` stays as the visible "archived" flag; `deleted_at` is the soft-delete sentinel (a row with deleted_at set is "deleted" and hidden from normal queries).
- Update DELETE routes: instead of hard-deleting, set `deleted_at = datetime('now')` (soft delete). For projects, cascade soft-delete to tasks. Keep a hard-delete option for admins if desired, but default to soft.
- Update queries to exclude `deleted_at IS NOT NULL` rows (projects list, tasks list, analytics, search, activity, etc.).
- This is the trickiest change — audit every SELECT in routes to add `WHERE deleted_at IS NULL`.

## 6. Versioned migration framework
- Add a `schema_migrations` table: `(id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at TEXT DEFAULT (datetime('now')))`.
- Convert `migrate()` to check `schema_migrations` for each migration name and only run migrations not yet applied, recording them after success.
- Wrap each migration in a transaction. If a migration fails, it rolls back and is NOT recorded.
- Keep the existing idempotent column-adds but track them as named migrations.

## 7. Schema validation (CHECK constraints)
- `projects.progress` → `CHECK(progress BETWEEN 0 AND 100)`.
- Date columns (`start_date`, `due_date`) → validate format in app code (ISO YYYY-MM-DD) on write, rather than SQL CHECK (simpler and avoids migration complexity).
- Add app-level validation in routes: reject invalid dates, progress out of range, invalid status/priority.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- **CRITICAL: do NOT lose data.** All migrations must preserve existing rows. Test on a copy of the deployed DB.
- Preserve all existing functionality.
- For soft-delete, audit and update all queries (this is the highest-risk change — do it carefully).
- If multer can't be installed, use base64/JSON upload fallback for attachments.
- After implementing: (1) `cd frontend && npm run build`, (2) backend boots with fresh DB, (3) migration on a copy of existing DB preserves all rows.
- Report what you changed and any data-loss risks.

## Deliverables
- time_entries table + endpoints + time_spent recompute.
- attachments table + upload/download endpoints + /data/uploads storage.
- task_watchers table + endpoints.
- notifications table + creation in key places + endpoints.
- deleted_at soft-delete on tasks/projects + query updates.
- schema_migrations versioned framework.
- progress/date validation.
- Build passes; backend boots; data preserved.
