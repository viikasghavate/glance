# Glance — Add Fields to Project & Task Records

Add new fields to the `projects` and `tasks` tables, expose them through the API, and surface them in the UI. **Must include a safe schema migration** so the already-deployed SQLite DB (with real data) is upgraded without data loss.

## New Fields

### projects (add these columns)
- `status` TEXT DEFAULT 'active' — values: active | on_hold | completed | archived
- `start_date` TEXT (nullable, ISO date)
- `due_date` TEXT (nullable, ISO date)
- `owner_id` INTEGER (nullable, FK → users.id, ON DELETE SET NULL)
- `priority` TEXT DEFAULT 'medium' — low | medium | high
- `progress` INTEGER DEFAULT 0 — 0-100

### tasks (add these columns)
- `labels` TEXT DEFAULT '' — comma-separated labels
- `start_date` TEXT (nullable, ISO date)
- `estimated_hours` REAL (nullable)
- `time_spent` REAL DEFAULT 0
- `reporter_id` INTEGER (nullable, FK → users.id, ON DELETE SET NULL)
- `archived` INTEGER DEFAULT 0 — soft-delete flag

## Schema Migration (CRITICAL)
The DB is created by `backend/db.js` with `CREATE TABLE IF NOT EXISTS`. Since the tables already exist in the deployed DB, `CREATE TABLE IF NOT EXISTS` will NOT add new columns. Implement a **migration helper** in `backend/db.js` (or a new `backend/migrate.js` imported at boot) that:
1. After creating tables, checks which new columns are missing (via `PRAGMA table_info(projects)` / `PRAGMA table_info(tasks)`).
2. Runs `ALTER TABLE projects ADD COLUMN <col> <type> <default>` for each missing column.
3. Runs `ALTER TABLE tasks ADD COLUMN <col> <type> <default>` for each missing column.
4. Is idempotent — safe to run on every boot.
5. For FK columns (owner_id, reporter_id), add the column; SQLite ALTER TABLE can add a column with a REFERENCES clause, but to keep it simple and safe, add the column as plain INTEGER (nullable) and enforce referential integrity in app code (or add the FK constraint if SQLite allows it — verify). Prefer plain INTEGER nullable columns to avoid migration failures.

## Backend Changes
- `backend/db.js`: add the new columns to the CREATE TABLE statements (for fresh installs) AND the migration helper (for existing DBs).
- `backend/routes/projects.js`:
  - POST/PATCH: accept and persist the new fields (status, start_date, due_date, owner_id, priority, progress).
  - GET list: include owner name (JOIN users) and the new fields.
- `backend/routes/tasks.js`:
  - POST/PATCH: accept and persist new fields (labels, start_date, estimated_hours, time_spent, reporter_id, archived).
  - GET: include reporter name (JOIN users) and new fields.
- `backend/routes/users.js`: unchanged (already lists users for assignee/owner/reporter dropdowns).

## Frontend Changes
- `frontend/src/components/ProjectModal.jsx`: add inputs for status (select), start_date (date), due_date (date), owner_id (select from users), priority (select), progress (range 0-100 or number). The modal needs the `users` list — pass it as a prop (ProjectModal is rendered in Layout.jsx; fetch users there or pass from UIContext).
- `frontend/src/components/TaskModal.jsx`: add inputs for labels (text), start_date (date), estimated_hours (number), time_spent (number), reporter_id (select from users), archived (checkbox).
- `frontend/src/components/KanbanBoard.jsx` / `TaskList.jsx`: show new task fields where sensible (labels as small badges, start/estimated hours, archived styling). Keep it clean — don't clutter the board.
- `frontend/src/pages/ProjectListPage.jsx`: show project status/priority/progress/owner on cards.
- `frontend/src/pages/ProjectDetailPage.jsx`: pass users to modals; show project status/progress.
- `frontend/src/context/UIContext.jsx`: expose `users` list (fetch once) so modals can use it for owner/reporter/assignee dropdowns.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Do NOT change the Dockerfile or deployment.
- Preserve all existing functionality.
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Also verify the backend starts cleanly with a fresh DB (migration runs without error): `cd backend && DB_PATH=/tmp/glance-migrate-test.db node server.js` (start, check it boots, then kill).
- Report what you changed and any issues.

## Deliverables
- Updated db.js with migration helper + new columns.
- Updated project/task routes.
- Updated modals, board, list, pages, UIContext.
- Build passes; backend boots with migration.
