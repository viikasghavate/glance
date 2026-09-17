# SPEC — Live Notification Unread-Count Badge (periodic refresh)

## Objective
The top-bar notification bell badge shows the unread count, but it is only fetched
**once on mount** and after the dropdown is opened/closed
(`frontend/src/components/Layout.jsx` ~line 157-168: `apiFetch('/notifications/unread-count')`
inside a `useEffect(..., [apiFetch])`). While a user is on any page and receives a new
notification (e.g. `comment_added`, `task_assigned` generated elsewhere / by another user),
the badge stays stale until they manually open the bell. Add a **periodic refresh** of the
unread count so the badge stays live. Pure frontend — no backend change, no DB/schema change,
no new dependencies.

## Assumptions / current state (verified in main)
- Backend `GET /api/notifications/unread-count` returns `{ count }` and is `requireAuth`
  protected. Already consumed in `Layout.jsx`.
- `Layout.jsx` already has a `useEffect` that fetches `unread-count` + notifications list on
  mount with an `active` cleanup flag, plus a `setInterval(() => setNow(...), 1000)` clock.
- State: `unreadCount` (number), `setUnreadCount`. `notifOpen` gates the dropdown.
- The existing on-mount effect also loads the full `notifications` list — leave that as-is
  (kept at mount + on open), only the lightweight `unread-count` gets polled.
- `apiFetch` is stable (from `useAuth`), so effects with `[apiFetch]` deps run once.

## Scope — touch ONLY
- `frontend/src/components/Layout.jsx`

Do NOT touch the backend, other components, or `Layout.css`. No refactors of the existing
bell/dropdown logic.

## Behavior
1. Add a lightweight poll that refreshes `unreadCount` on an interval (e.g. **every 30s**)
   while the component is mounted, and clears on unmount.
2. Poll must stop while the dropdown is open (avoid fighting the open-time
   `read-all` + `setUnreadCount(0)`), and resume after it closes. Simplest: in the poll
   callback, `if (notifOpen) return;` (use a ref mirror of `notifOpen` if the closure needs a
   stable read, mirroring how the component already mirrors other state to `*Ref` vars).
3. On each tick, `apiFetch('/notifications/unread-count')` → if `active`, `setUnreadCount(d.count || 0)`.
   Swallow errors silently like the existing code.
4. Keep the existing on-mount + on-open behavior unchanged (badge clears on open via
   `read-all`; poll resumes after close).
5. Interval 30s is fine; do not go below 20s. No full list re-fetch on poll — unread-count only.

## Success criteria
- `cd frontend && npm run build` succeeds.
- Backend boots with no errors (no backend change).
- Manual: with the app open, insert a new notification (e.g. comment / assign) from a second
  session; the badge increments within ≈30s WITHOUT reopening the bell. Opening the bell still
  marks read and clears the badge; polling resumes after close.
- No regression to mount/open behavior; no console errors.

## Constraints
- Frontend-only. No backend, no schema, no migration, no new deps.
- Do not hand-edit source — implement via the coding agent.
- Keep prod healthy; no destructive operations.
