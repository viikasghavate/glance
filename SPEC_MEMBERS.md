# Glance — Enhance Members Management Page

Upgrade the Members page (`/users`, admin-only) from a basic table into a full member-management page. Add the following features.

## Features to add

### 1. Add Member (admin creates users directly)
- A "Add Member" button that opens a modal/form with: name, email, password, role (admin/member/viewer).
- Backend: new `POST /api/users` (admin only) that creates a user with the given role. Validate email uniqueness, required fields, and role value.
- After creation, refresh the member list.

### 2. User stats (per member)
Show in the table (or a detail area) for each user:
- **Projects owned** (count of projects where owner_id = user.id)
- **Tasks assigned** (count of tasks where assignee_id = user.id)
- **Tasks completed** (count of tasks where assignee_id = user.id AND status = 'done')
- **Comments** (count of comments where user_id = user.id)
- Backend: extend `GET /api/users` to include these counts (JOIN/aggregate queries). Return as `stats: { projectsOwned, tasksAssigned, tasksCompleted, comments }`.

### 3. Search & filter
- A search input to filter members by name or email (client-side).
- A role filter dropdown (All / Admin / Member / Viewer).

### 4. Edit name
- Inline edit or an edit action to rename a user.
- Backend: `PATCH /api/users/:id` (admin only) to update `name` (and optionally email). Validate.

### 5. Remove member
- A "Remove" action per user with a confirmation dialog.
- Backend: `DELETE /api/users/:id` (admin only). Handle referential integrity: set `assignee_id`/`reporter_id`/`owner_id` to NULL on tasks/projects where this user is referenced (or reassign), and delete their comments (or set user_id NULL). Simplest safe approach: set referenced FKs to NULL and delete the user's comments. Do NOT allow deleting the last admin.

### 6. Prevent self-demotion / self-removal (safety)
- An admin cannot change their own role to non-admin, and cannot remove themselves, if they are the **only** admin. (If there are multiple admins, allow it but warn.)
- Backend: enforce in the role-change and delete endpoints — if the target user is the last admin, reject with a clear error.

### 7. Last active
- Add a `last_login_at` column to users (nullable). Update it on successful login.
- Show "Last active" in the table (relative time or date). If never logged in, show "Never".

## Backend changes
- `backend/db.js`: add `last_login_at TEXT` column to users (CREATE + migration helper, same idempotent pattern).
- `backend/routes/auth.js`: on successful login, set `last_login_at = datetime('now')` for the user.
- `backend/routes/users.js`:
  - `GET /` — include stats (projects owned, tasks assigned, tasks completed, comments) and last_login_at.
  - `POST /` — admin only, create user with role.
  - `PATCH /:id` — admin only, update name/email.
  - `PATCH /:id/role` — admin only (existing), add last-admin protection.
  - `DELETE /:id` — admin only, with FK cleanup + last-admin protection.
- All new/changed user routes require `requireRole('admin')`.

## Frontend changes
- `frontend/src/pages/UserManagementPage.jsx`:
  - Add "Add Member" button + modal (name, email, password, role).
  - Add search input + role filter.
  - Add stats columns (projects owned, tasks assigned, tasks done, comments).
  - Add "Last active" column.
  - Add edit-name action (inline or modal).
  - Add "Remove" action with confirmation.
  - Disable role-change/remove for the last admin (or show a warning).
- `frontend/src/components/` — add a `MemberModal.jsx` (add/edit member) if helpful, or keep inline.
- `frontend/src/App.jsx` — no route changes needed (already has `/users`).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Use the existing idempotent migration pattern for the new `last_login_at` column.
- Preserve all existing functionality (RBAC, project/task features).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Verify backend boots with a fresh DB (migration runs).
- Report what you changed and any issues.

## Deliverables
- Backend: last_login_at column + migration, user stats in GET /users, POST/PATCH/DELETE user endpoints (admin only), last-admin protection, last_login update on login.
- Frontend: enhanced Members page (add member, search/filter, stats, last active, edit name, remove, last-admin safety).
- Build passes; backend boots.
