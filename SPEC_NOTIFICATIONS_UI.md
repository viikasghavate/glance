# Feature: Notification Bell (frontend UI)

## Objective
The backend already has full notification APIs (`GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/read-all`, `POST /api/notifications/:id/read`) and notifications are generated (`task_assigned`, `comment_added`, `dependency_done`). But there is **no frontend UI** — users never see them. Add a notification bell to the top bar with an unread-count badge and a dropdown listing notifications, plus mark-read on open and mark-all-read.

## Assumptions
- Frontend is React + Vite (`frontend/src`), uses `useAuth().apiFetch` for authenticated API calls (token in localStorage, base via `API` constant).
- Top bar lives in `frontend/src/components/Layout.jsx` (the `<header className="top-bar">`).
- Notifications are per-user (backend filters by `req.user.id`).
- Notification record fields: `id, type, title, body, payload (JSON string), read (0/1), created_at`.
- Styling: existing `Layout.css` uses CSS variables (`var(--text-muted)` etc.). Follow the app's existing dark "ClickUp-dark" style; keep it consistent with the search dropdown pattern already in Layout.jsx.

## Scope
- **Backend:** No changes required (API already exists and is `requireAuth`-protected). Only verify the routes are mounted — they are (`app.use('/api/notifications', ...)` in `server.js`).
- **Frontend:** Notification bell + unread badge + dropdown in `Layout.jsx` (top bar right, next to user menu), plus styles in `Layout.css`.

## Success criteria
1. A bell icon appears in the top bar (right side) for logged-in users.
2. A red/solid badge shows the unread count (from `/api/notifications/unread-count`). Badge hides when count is 0.
3. Clicking the bell opens a dropdown listing the latest ~20 notifications (title, body, relative timestamp, unread highlighted/dot).
4. Opening the dropdown marks all as read (`POST /api/notifications/read-all`) and the badge clears.
5. Individual notification rows: clicking a notification navigates to its target if a `payload` with `project_id` (and optionally `task_id`) is present — else no-op. Rows also visually mark-unread when clicked if not already read.
6. Unread count refreshes on mount and after opening the dropdown; no full-page reload.
7. `npm run build` passes in `frontend/`.

## Constraints
- Do NOT modify backend routes or the notifications table.
- Do not hand-edit source files directly — implement via the coding agent.
- Keep prod healthy; no destructive operations.
- Match existing UI patterns (search dropdown pattern in Layout.jsx, CSS variables, icon components as inline SVGs like the existing `IconSearch`/`IconBell`-style).
- Add a bell icon as a small inline SVG component consistent with existing icons.

## Relative timestamps
Show a compact relative time (e.g. "2m", "5h", "3d") for `created_at`. Handle parsing of SQLite `datetime('now')` format (UTC "YYYY-MM-DD HH:MM:SS").

## Verification
- `cd frontend && npm run build` succeeds.
- Backend loads (`node backend/server.js` or the project's normal start) without errors.
- Manually confirm bell renders, badge shows unread count, dropdown opens, mark-read works.
