# SPEC: Sprints + Milestones

Add sprint/iteration and milestone grouping to Glance. This unlocks sprint boards and velocity tracking.

## Objective
Let users organize tasks into **sprints** (time-boxed iterations) and **milestones** (named checkpoints/goals). Tasks belong to at most one sprint and one milestone. This is a data-model + API + UI addition, following the existing migration + route + frontend patterns.

## Background (current state)
- Stack: Node/Express + better-sqlite3 backend, React/Vite frontend, single Docker container.
- DB: SQLite at `DB_PATH` (default `/data/glance.db`), versioned migrations via `schema_migrations` table in `backend/db.js` (see existing `migrations` array, 21 entries). `hasColumn(table, col)` helper exists.
- Existing patterns to copy: `labels`/`tags` tables (lookup table + join table + `tags.js`/`labels.js` routes), `task_dependencies`, soft-delete `deleted_at` on tasks/projects, `SPEC_DATAMODEL.md` / `SPEC_DATAMODEL2.md` for prior data-model work.
- Routes live in `backend/routes/*.js`, mounted in `server.js`. Frontend: `frontend/src/pages/*.jsx`, `frontend/src/components/*.jsx`.

## Assumptions
- A task belongs to **at most one** sprint and **at most one** milestone (both nullable). No multi-sprint tasks.
- Sprints and milestones are **per-project** (scoped to `project_id`), not global.
- Deleting a sprint/milestone sets `sprint_id`/`milestone_id` to NULL on its tasks (no cascade delete of tasks).
- Existing data preserved: migration must be additive only; `ALTER TABLE` + new tables.
- Keep the existing neutral/neon dark theme styling; match existing UI conventions.

## Scope — touch ONLY these
Backend:
- `backend/db.js` — add `sprints`, `milestones` tables + migration entries; add `sprint_id`, `milestone_id` columns to `tasks` (via migration + base CREATE TABLE).
- `backend/routes/sprints.js` (new)
- `backend/routes/milestones.js` (new)
- `backend/server.js` — mount the two new route files.
- `backend/services/activity.js` — log sprint/milestone actions (reuse existing pattern).

Frontend:
- `frontend/src/pages/ProjectDetailPage.jsx` — add sprints + milestones sections/UI.
- `frontend/src/components/` — add Sprint/Milestone components (reuse modal + list patterns).
- Any supporting CSS files.

Do NOT touch unrelated routes (auth, users, comments, attachments, time_entries, notifications, etc.) or unrelated UI. No drive-by refactors.

## Data model
```
sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned',  -- planned | active | completed
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)

milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',     -- open/completed
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)
```

Add to `tasks` (nullable, FK to respective tables, ON DELETE SET NULL):
```
sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL
```
Indexes: `idx_sprints_project_id`, `idx_milestones_project_id`, `idx_tasks_sprint_id`, `idx_tasks_milestone_id`.

## Endpoints
`/api/sprints` (scoped by project)
- `GET /api/projects/:projectId/sprints` — list sprints for project, with task counts + status.
- `POST /api/projects/:projectId/sprints` — create {name, goal, start_date, end_date}.
- `PATCH /api/sprints/:id` — update {name, goal, start_date, end_date, status}.
- `DELETE /api/sprints/:id` — soft-ish delete (set tasks.sprint_id=NULL, then delete row).

`/api/milestones` (scoped by project)
- `GET /api/projects/:projectId/milestones` — list with task counts.
- `POST /api/projects/:projectId/milestones` — create {name, description, due_date}.
- `PATCH /api/milestones/:id` — update.
- `DELETE /api/milestones/:id` — set tasks.milestone_id=NULL, delete row.

Task assignment:
- Extend existing task create/update endpoints to accept + persist `sprint_id`, `milestone_id`.
- `GET /api/tasks` / `GET /api/projects/:projectId/tasks` should return `sprint_id`, `milestone_id` (and optionally sprint/milestone names) so the UI can render badges.

## Frontend
- Project detail page: show **Sprints** and **Milestones** sections (match existing section styling).
- Sprint list: name, goal, dates, status, task count; create/edit/delete; mark active/completed.
- Milestone list: name, description, due_date, status; create/edit/delete.
- Task detail / task form: sprint + milestone dropdowns (filtered to the task's project).
- Kanban/list/timeline views: show a small badge on tasks for sprint/milestone (optional but nice).
- Apply `sprint_id`/`milestone_id` when creating/editing tasks.

## Success criteria (verifiable)
1. Fresh DB boots, all migrations apply (including new sprints/milestones/task columns).
2. Migration is additive on an existing DB: old data preserved, old schema still works.
3. CRUD works end-to-end for sprints and milestones via API (create → list → update → delete).
4. Deleting a sprint/milestone nulls the FK on its tasks (tasks survive).
5. Tasks accept sprint_id/milestone_id on create/update; list endpoints return them.
6. Frontend builds clean (`npm run build`), renders sprint + milestone sections, and task badges/dropdowns.
7. Backend tests pass; add tests covering sprint/milestone CRUD + FK-null-on-delete.
8. `git status` clean of unintended changes; only the files in Scope are modified.

## Constraints
- Match existing code style (look at `labels.js`/`tags.js`/`task_dependencies` for the closest patterns).
- Keep it simple — no speculative features (no auto-planning, no drag-drop reordering of sprints unless trivial).
- Do not change the existing theme or refactor unrelated files.
- Run tests + build before considering done; report results.
