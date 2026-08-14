# Glance — Add Role-Based Access Control (RBAC)

Add role-based permissions to Glance. Currently all authenticated users have full access. Add three roles and enforce them on the backend and frontend.

## Roles
- **admin** — full access. Can manage users (change roles), create/edit/delete any project & task, view everything.
- **member** — can create/edit/delete projects & tasks, comment, but CANNOT manage users or change roles.
- **viewer** — read-only. Can view projects, tasks, comments, but CANNOT create/edit/delete anything.

## Data model (backend/db.js)
- Add `role TEXT NOT NULL DEFAULT 'member'` column to `users` table (in CREATE TABLE for fresh installs AND in the `migrate()` helper for existing DBs, so the deployed DB upgrades without data loss — same pattern as the existing project/task migrations).
- **First user becomes admin:** in `seed.js` (or on register), if the users table is empty before the first register, assign the first user `role = 'admin'`. Simplest: in the register route, check `SELECT COUNT(*) FROM users` — if 0, set role='admin', else default 'member'.

## Backend changes
- `backend/routes/auth.js`:
  - `POST /register`: set the first user's role to `admin` (if no users exist), else `member`. Return `role` in the user object and include it in the JWT payload.
  - `POST /login`: include `role` in the returned user object and in the JWT.
  - `GET /me`: return `role`.
- `backend/middleware/auth.js`:
  - Add a `requireRole(...allowedRoles)` middleware factory that checks `req.user.role` is in the allowed list; return 403 if not.
  - `requireAuth` already exists and sets `req.user` from the JWT. Ensure `req.user.role` is available (it comes from the JWT payload).
- Enforce roles on routes:
  - `backend/routes/projects.js`: POST (create), PATCH (edit), DELETE require `admin` or `member`. GET is open to all authenticated.
  - `backend/routes/tasks.js`: POST, PATCH, DELETE, and reorder require `admin` or `member`. GET open to all.
  - `backend/routes/comments.js`: POST require `admin` or `member`. GET open to all.
  - `backend/routes/users.js`: GET (list users) — allow all authenticated (needed for assignee dropdowns). 
  - **NEW** `PATCH /api/users/:id/role` (or `PATCH /api/users/:id`) — **admin only** — to change a user's role. Validate role value is one of admin/member/viewer.
- IMPORTANT: the JWT already contains role; if you change a user's role, their existing token still has the old role until they re-login. To keep it simple for MVP, note this limitation (role changes take effect on next login). Do NOT add token invalidation.

## Frontend changes
- `frontend/src/context/AuthContext.jsx`: `user` object now includes `role`. Add a helper `hasRole(...roles)` or expose `user.role`. Keep the token/localStorage flow unchanged.
- **Hide/show UI by role:**
  - Hide "New Project", "Edit", "Delete", "Archive" buttons and the sidebar "+ New" / "New Project" for `viewer` users.
  - Hide "New Task", task edit/delete, reorder (drag-drop) for `viewer` users.
  - Hide "Add Comment" for `viewer` users.
  - ProjectModal / TaskModal should not be openable by viewers.
- **User management page (admin only):**
  - New route `/users` (or `/admin/users`), linked from the icon rail or a new "Members" nav item.
  - Lists all users with their role, and an admin can change each user's role via a dropdown (admin/member/viewer).
  - Only visible to admin users.
- `frontend/src/App.jsx`: add the new route, wrapped in an admin-only guard (redirect non-admins away).
- `frontend/src/components/Layout.jsx`: conditionally render the "Members"/user-management nav item only for admins.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Use the existing migration pattern (idempotent ALTER TABLE ADD COLUMN) for the new `role` column.
- Preserve all existing functionality.
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Verify backend boots with a fresh DB (migration runs, first user gets admin): start server with a temp DB, register a user, confirm role='admin'.
- Report what you changed and any issues.

## Deliverables
- `role` column added (CREATE + migration).
- Backend role enforcement (requireRole middleware + route guards + admin-only role-change endpoint).
- Frontend role-aware UI (hide actions for viewers, admin user-management page).
- Build passes; backend boots and first user is admin.
