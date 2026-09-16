# SPEC — Activity Log: Filter by Actor (User)

## Objective
Let users filter the Activity Log by who performed the action. Today the page
filters by entity type (Task/Comment/…) and free-text `q` — but not by actor.
This closes a real gap: an admin auditing "what did X do this week?" has to
scroll/search by name manually. Add a backend `user_id` query param and a
frontend actor `<select>` dropdown on the Activity Log page.

## Assumptions (verified in main)
- Backend `backend/routes/activity.js`, mounted at `/api/activity`, uses the app's
  dual-engine DB (`db` from `../db.js`; sqlite sync / pg adapter both accept the
  `?`-dialect — the pg client transpiles `?`→`$n` per query). Existing filters in
  `GET /` and `/export`: `project_id`, `entity_type`, `q`, `limit`. The query
  LEFT JOINs `users u` on `a.user_id = u.id` and `tasks t`.
- Frontend `frontend/src/pages/ActivityLogPage.jsx` (`/activity`, icon-rail nav):
  - gets `const { apiFetch } = useAuth();`
  - renders `.activity-filters` (a `q` search input + `entity_type` `<select>` +
    `Export CSV` button) with options from `ENTITY_FILTERS`.
  - already has `entityType`/`query`/`debouncedQuery` state; `load(type, reset)`
    builds `params` with `limit`, `entity_type`, `q`.
  - resets `limit` to `PAGE_SIZE` on filter change (`handleEntityTypeChange`).
- `GET /api/users` (`backend/routes/users.js`) returns `[{ id, name, email, role, ... }]`,
  `requireAuth`-protected — callable via `apiFetch('/users')`. No new endpoint needed
  for the dropdown source. Do NOT change it.
- Styling: `.activity-filter-select` / `.activity-filter-input` already exist in
  `ActivityLogPage.css`; reuse the same selector class for the new dropdown (no new
  CSS required).

## Scope — touch ONLY
- `backend/routes/activity.js` — add `user_id` to `GET /` and `GET /export`.
- `frontend/src/pages/ActivityLogPage.jsx` — fetch users once, add an "All Users"
  `<select>` in `.activity-filters`, thread `user_id` into the request + export.

Do NOT touch: db.js, pg/client.js, users.js, server.js, other pages/components,
package.json, CSS (reuse existing classes). No schema/migration. No new deps.

## Backend — `backend/routes/activity.js`
1. In both `GET /` and `GET /export`, destructure `user_id` from `req.query`
   alongside the existing `project_id, entity_type, q, limit`.
2. If `user_id` present and truthy, push into conditions:
   `conditions.push('a.user_id = ?')` and `values.push(user_id)`. It combines AND
   with the existing `entity_type`/`q` filters (match the exact pattern already
   used for `entity_type`). The `?` placeholder is engine-agnostic (works on both
   sqlite and the pg adapter).
3. Keep ordering, LIMIT handling, SELECT, and CSV output identical. `user_id` is a
   filter only — no new columns in the response or CSV.
4. For `GET /export`: same condition addition; leave `LIMIT 5000` and headers
   unchanged.

## Frontend — `frontend/src/pages/ActivityLogPage.jsx`
1. Add state: `const [users, setUsers] = useState([]);` and
   `const [userId, setUserId] = useState('');`
2. Fetch users once on mount (new `useEffect(..., [])`): `apiFetch('/users')`,
   `setUsers(data || [])`. Wrap in try/catch; on error, `setUsers([])` (the filter
   just stays empty — never break the page).
3. In `load(type, reset)`: when `userId` is set, `params.set('user_id', userId)`.
   Add `userId` to the `useCallback` dep array.
4. Add `handleUserIdChange(e)` that does `setLimit(PAGE_SIZE); setUserId(e.target.value);`
   (mirror `handleEntityTypeChange`).
5. In the `.activity-filters` div, after the entity `<select>`, add an actor
   `<select className="activity-filter-select" value={userId} onChange={handleUserIdChange}>`:
   - `<option value="">All Users</option>`
   - `{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}`
6. In `handleExportCsv`, add `if (userId) params.set('user_id', userId);` next to the
   entity_type/q params so the export honors the same filter.
7. The reload effect already depends on `[entityType, debouncedQuery, limit]` — add
   `userId` to that dependency array so changing the actor refetches (and resets).

## Success criteria
1. `cd frontend && npm run build` passes clean; backend boots with no errors.
2. `GET /api/activity?user_id=<id>` returns only rows whose `user_id` matches, and
   combines correctly with `entity_type`/`q` (AND).
3. `GET /api/activity/export?user_id=<id>` exports only that user's rows.
4. Activity page shows an "All Users" dropdown; selecting a user filters the list;
   changing it resets to PAGE_SIZE and refetches; combined with entity/search works.
5. Works against a COPY of the LIVE database (real users + activity rows) on both
   the sqlite and pg engines — no column/index/param errors. Never run destructive
   commands on the live DB.
6. No regression: entity filter, text search, Export CSV, load-more all still work.

## Constraints
- Match existing route/page style exactly. Reuse `.activity-filter-select` class.
- No destructive/mass commands, no secrets in logs. Keep prod healthy.
