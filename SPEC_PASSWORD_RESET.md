# SPEC — Admin Password Reset (Option A)

## Goal
Allow an **admin** to reset any user's password from the User Management page. No email service. Admin sets a new password directly; user logs in with it.

## Backend — `backend/routes/users.js`

Add a new admin-only route:

```
PATCH /api/users/:id/password
Body: { "password": "<new password>" }
```

Behavior:
- `requireRole('admin')` (route already has `router.use(requireAuth)`; add `requireRole('admin')` on this route like the others).
- Validate `password` present, non-empty, `length >= 4` (match register/login minLength).
- Load user by `:id`; 404 if not found.
- Hash with `bcrypt.hashSync(password, 10)`.
- `UPDATE users SET password_hash = ? WHERE id = ?`.
- Log activity: `logActivity(req.user.id, 'user.password_reset', 'user', user.id, user.name)`.
- Return `{ success: true }`.

Do NOT allow resetting your own password via this route (admin should use profile change if needed) — but simplest: allow it, it's harmless. Keep it simple: allow.

## Frontend — `frontend/src/pages/UserManagementPage.jsx`

Add a "Reset Password" action per user row (in the Actions cell, next to Edit/Remove):
- Button labeled **Reset Password** (btn-ghost btn-sm).
- Opens a small modal (reuse existing modal pattern / `.modal-overlay` + `.modal` classes) with:
  - Title: "Reset Password"
  - Text: "Set a new password for <strong>{user.name}</strong>."
  - Single password input (type=password, minLength 4, required).
  - Cancel + "Reset Password" (btn-primary) buttons.
- On submit: `apiFetch('/users/' + user.id + '/password', { method: 'PATCH', body: JSON.stringify({ password }) })`.
- On success: close modal, clear error, show a success message (e.g. `setError('')` + a transient success banner or just close). Keep it simple: close modal and show a brief success state.
- On error: show error in modal.

State to add: `resetUser` (the user being reset, or null), `newPassword`, `resetError`, `resetSubmitting`.

## Verification
- Backend: `npm run dev` in `backend/`, curl the new route with an admin token → 200 + `{success:true}`; wrong role → 403; missing/short password → 400; bad id → 404.
- Frontend: build passes (`npm run build` in `frontend/`), reset flow works in browser against local backend.
- Confirm the reset user can log in with the new password.

## Notes
- No DB schema change needed (password_hash already exists).
- No email infra involved.
