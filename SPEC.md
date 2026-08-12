# Glance — Project Management Tool (MVP)

## Overview
A self-hosted project management MVP. Single-page React app with a Node.js/Express + SQLite backend. Deployed via Coolify behind `glance.ghavate.com`.

## Tech Stack
- **Backend:** Node.js (>=18), Express, SQLite (better-sqlite3), JWT auth (jsonwebtoken), bcryptjs
- **Frontend:** React 18 + Vite, React Router, plain CSS (no heavy UI framework)
- **Build:** Docker multi-stage build (frontend build → static served by Express, OR separate nginx). **Decision:** single container — Express serves the built React SPA + JSON API. Simplest for Coolify.

## Data Model (SQLite)
- **users**: id, email (unique), password_hash, name, created_at
- **projects**: id, name, description, color, archived (bool), created_at, updated_at
- **tasks**: id, project_id (FK), title, description, status (todo|in_progress|done), priority (low|medium|high), due_date (nullable), assignee_id (FK users, nullable), position (int, for kanban ordering), created_at, updated_at
- **comments**: id, task_id (FK), user_id (FK), body, created_at

## API Endpoints (JSON, /api prefix)
Auth:
- POST /api/auth/register — {email, password, name}
- POST /api/auth/login — {email, password} → {token, user}
- GET /api/auth/me — returns current user (Bearer token)

Projects:
- GET /api/projects — list (exclude archived by default? include ?includeArchived=true)
- POST /api/projects — {name, description, color}
- PATCH /api/projects/:id — update fields
- DELETE /api/projects/:id — delete (cascade tasks/comments)

Tasks:
- GET /api/projects/:projectId/tasks — list tasks for project
- POST /api/projects/:projectId/tasks — {title, description, status, priority, due_date, assignee_id}
- PATCH /api/tasks/:id — update any field
- DELETE /api/tasks/:id
- POST /api/tasks/:id/reorder — {status, position} for kanban drag-drop ordering

Comments:
- GET /api/tasks/:id/comments
- POST /api/tasks/:id/comments — {body}

Users:
- GET /api/users — list (for assignee dropdown)

## Auth
- JWT Bearer token. Middleware `requireAuth` on all /api routes except register/login.
- Seed a default admin user on first boot: email `admin@glance.local`, password `admin123` (documented, changeable).

## Frontend Pages (React Router)
- `/login` — login/register
- `/` — project list (cards with name, description, color, task counts)
- `/project/:id` — project detail with two views:
  - **Board (Kanban):** 3 columns (To Do / In Progress / Done), drag-drop between columns and reorder within column
  - **List:** table of tasks with filters (status, priority, assignee)
- Task detail: modal or drawer showing task info + comments thread
- Create/edit project modal
- Create/edit task modal

## UX Notes
- Clean, modern, minimal. No heavy framework — hand-written CSS, CSS variables for theming.
- Responsive enough for desktop + tablet.
- Drag-drop: use native HTML5 drag events (no extra library) OR @dnd-kit if simpler. Prefer native to keep deps light.

## Docker
- Multi-stage Dockerfile:
  - Stage 1: node:20-alpine, build frontend (npm ci, npm run build)
  - Stage 2: node:20-alpine, copy backend + frontend dist, npm ci --omit=dev
  - Expose port 3000
  - CMD: node server.js
- SQLite DB file at `/data/glance.db` (volume) — use env `DB_PATH` with default `/data/glance.db`.
- Health check: GET /health → 200.

## Env Vars
- `PORT` (default 3000)
- `DB_PATH` (default /data/glance.db)
- `JWT_SECRET` (default a dev secret; set real one in Coolify)

## Deliverables
- Working app: register/login, create projects, create tasks, kanban drag-drop, list view, comments.
- Dockerfile that builds and runs.
- README with run instructions.
- All code committed to git in /home/ubuntu/projects/glance.
