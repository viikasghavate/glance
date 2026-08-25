# SPEC: Settings page — Profile + Appearance

Wire up the dead Settings button in the left icon rail to a real `/settings` page. Build two sections: **Profile** (self-service account edits) and **Appearance** (theme toggle).

## Objective
- Make the rail Settings button navigate to `/settings`.
- **Profile:** the logged-in user can change their own name, email, and password. (Current `PATCH /api/users/:id` and `PATCH /api/users/:id/password` are `requireRole('admin')` — a non-admin can't edit their own. Add self-service capability.)
- **Appearance:** theme toggle (neon cyberpunk ↔ a lighter/dark alt theme) persisted to localStorage, applied via CSS custom properties in `:root`. Frontend-only.

## Background (current state)
- App.jsx routes: `/login`, `/` (Layout), index → Dashboard, `projects`, `project/:id`, `users`. No `/settings`.
- Layout.jsx: Settings button (line ~221) is a plain `<button>` with no onClick — dead. Has `IconSettings`.
- Auth: `frontend/src/context/AuthContext.jsx` exposes `user` + `hasRole`; token in localStorage; `apiFetch` helper. `useNavigate` from react-router.
- Profile endpoints exist but are admin-only:
  - `PATCH /api/users/:id` — name/email (users.js)
  - `PATCH /api/users/:id/password` — password (users.js)
- Theme: all colors are CSS custom properties in `frontend/src/index.css` `:root` (`--bg`, `--bg-card`, `--bg-card-solid`, `--bg-hover`, `--bg-input`, `--border`, `--text`, `--text-muted`, etc.).
- Existing page pattern to copy: `frontend/src/pages/UserManagementPage.jsx` (uses AuthContext `user`, apiFetch, has forms/modals). CSS files per page (`*.css`).
- Routes mounted in `backend/server.js`; route files in `backend/routes/`.

## Assumptions
- A user can only edit their OWN profile here (self-service). Admin member-management stays on the Members page.
- Password change for self requires the **current password** to be verified (security). Admin reset (existing feature) stays unchanged.
- Appearance theme is purely a frontend preference — no backend, no DB. Persisted in `localStorage`.
- Keep the existing neon cyberpunk as the **default** theme; add one alternate (e.g. a calmer light theme) via a second CSS-variable set.
- Match existing UI conventions (modals, buttons, section cards, page container).

## Scope — touch ONLY these
Backend:
- `backend/routes/users.js` — add a **self-service** profile endpoint (e.g. `PATCH /api/users/me`) that any authenticated user can call to update their own name/email, and verify+change their own password (`PATCH /api/users/me/password`). Reuse existing validation/logging patterns. Do NOT change existing admin endpoints.
- `backend/server.js` — no change needed if route is added inside users.js (mounted already). Confirm.

Frontend:
- `frontend/src/App.jsx` — add `<Route path="settings" element={<SettingsPage />} />`.
- `frontend/src/components/Layout.jsx` — make Settings button navigate to `/settings` (wrap in Link or add onClick navigate, matching how Members/Dashboard do it).
- `frontend/src/pages/SettingsPage.jsx` (new) — Profile + Appearance sections.
- `frontend/src/pages/SettingsPage.css` (new).
- `frontend/src/index.css` — add an alternate theme variable block (e.g. `[data-theme="light"]` or `.theme-light` overrides) applied on `<html>`/`<body>`.

Do NOT touch unrelated files. No drive-by refactors.

## Profile section behavior
- Show current name, email, role, member-since.
- Edit name, edit email (save → PATCH self; update AuthContext user state).
- Change password: current password + new password + confirm. Verify current password; error if wrong; success message on change.
- After email change, update `AuthContext.user` so UI reflects it immediately.

## Appearance section
- Theme toggle (e.g. radio/select: Neon (default) / Light).
- Persist choice to `localStorage` (`glance_theme`).
- Apply theme class/attr on mount + on change (set on `document.documentElement`).
- Show a small live preview/swatch.

## Success criteria (verifiable)
1. `npm run build` passes clean.
2. `/settings` route renders the Settings page; Settings rail button navigates there and highlights as active.
3. A non-admin user can update their own name/email via the self endpoint (API test).
4. Password change verifies the current password; wrong current → 400/error; correct → password actually changes (login with new password works, old fails).
5. AuthContext.user reflects name/email change immediately.
6. Theme toggle switches the CSS vars, persists across reload (localStorage), and defaults to Neon.
7. Only spec-scope files changed (`git status`).
8. Backend smoke test for the two new self endpoints.

## Constraints
- Match existing code style and theme.
- Keep it simple — no speculative features (no avatar upload, no notification prefs, no workspace/admin settings yet).
- Do NOT touch the admin member-management or the existing password-reset (admin) features.
- Run `npm run build` + backend smoke tests before done; report results.
