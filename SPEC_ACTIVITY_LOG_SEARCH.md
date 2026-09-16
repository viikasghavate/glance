# SPEC — Activity Log: Text Search (q param + search box)

## Objective
Add **free-text search** to the Activity Log so users can find a specific audit
event (by action, user, entity name, or details) — the last major view without a
search box (List/Kanban/Timeline/My Tasks all have one). Because the Activity Log is
**server-side paginated** (limit, Load more), the search must be applied **on the
backend** via a new `q` query param, not client-side on the loaded rows. Mirrors the
existing `project_id` / `entity_type` filter params on `/api/activity`.

**Backend: read-only param.** No schema change, no migration, no data writes.

## Assumptions (verified in repo, main branch)
- `backend/routes/activity.js`:
  - `GET /` reads `{ project_id, entity_type, limit }`, builds a dynamic `WHERE`,
    LEFT JOINs `users` (user_name) and `tasks` (project_id when entity_type='task'),
    orders `created_at DESC, id DESC`, `LIMIT ?` (cap 200).
  - `GET /export` mirrors the same `WHERE` construction (LIMIT 5000).
- `activity_log` columns: `user_id, action, entity_type, entity_id, entity_name,
  details (JSON string|null), created_at`. `user_name` comes from joined `u.name`.
- `frontend/src/pages/ActivityLogPage.jsx`:
  - Has `entityType` state + `ENTITY_FILTERS` select, `limit` state (PAGE_SIZE=50,
    Load more caps at 200), and a `load(type, reset)` useCallback that builds
    `URLSearchParams` with `limit` + optional `entity_type`.
  - Has `handleExportCsv()` that builds the export URL with optional
    `entity_type` query, and a `.activity-filters` bar with the select + Export button.
  - `frontend/src/pages/ActivityLogPage.css` defines `.activity-filters`,
    `.activity-filter-select`. Reuse these classes; add new classes only if needed.

## Scope — touch ONLY
- `backend/routes/activity.js` (both `GET /` and `GET /export`)
- `frontend/src/pages/ActivityLogPage.jsx`
- `frontend/src/pages/ActivityLogPage.css` (only if a new class is required)

Do NOT touch db.js, server.js, other routes/pages/components, package.json.
No drive-by refactors. Keep the existing entity-filter, pagination, and CSV export intact.

## Behavior

### Backend — `q` param
In both `GET /activity` and `GET /activity/export`, accept `q` (trimmed). When
non-empty, add a search condition matching **case-insensitively** against:
- `a.action` (e.g. `task.created`, `user.login`)
- `a.entity_name`
- `a.entity_type`
- `u.name` (user_name) — only meaningful because the LEFT JOIN exists
- `a.details` (JSON string; substring match on the raw text is fine, e.g. `%` wrappers)

Use `WHERE` combined with **AND** alongside any existing `project_id` / `entity_type`
conditions. Implement as a LIKE with the value wrapped in `%...%`, matching the existing
dynamic-conditions pattern:
```js
if (q) {
  conditions.push(`(a.action LIKE ? OR a.entity_name LIKE ? OR a.entity_type LIKE ? OR u.name LIKE ? OR a.details LIKE ?)`);
  const like = `%${q}%`;
  values.push(like, like, like, like, like);
}
```
(Order the values to match the placeholder order.) Escape `%`/`_`? — no, plain substring
LIKE is acceptable and consistent with the app's simplicity; no regex/performance concerns
for a personal tool. Empty/whitespace `q` → no search condition (treat as absent).

### Frontend — search input
Add a text `<input>` (placeholder e.g. "Search activity…") in `.activity-filters`,
placed **before** the entity-type `<select>`.
- New state `query` (string). Typing updates it.
- Debounce ~300ms, then re-run `load` with a **reset** (fresh page, `limit` back to
  PAGE_SIZE) and include `q` in the URLSearchParams and in the export URL.
- Clearing the box removes the `q` param and reloads.
- Combine AND with the existing entity-type filter: both `entity_type` and `q` are sent.
- On `handleEntityTypeChange`, also reset `limit` (existing behavior) — keep the query
  when switching entity type (AND them).
- Reuse `.activity-filter-select` styling; give the input a matching class (e.g.
  `activity-filter-input`) and add minimal CSS only if it doesn't inherit cleanly.

## Success criteria
- Build passes: `cd frontend && npm run build`. Backend boots clean (`npm start` smoke).
- `GET /api/activity?q=login` returns only login/register/failed-login events
  (filtered by action). `q=alice` matches rows where the actor or entity name contains
  "alice". Case-insensitive (`Q=LOGIN` matches too).
- Combined: `?entity_type=user&q=alice` returns only user events whose joined actor name
  matches.
- Frontend: typing narrows the list (debounced), clearing restores full list, entity-type
  filter ANDs with search, Load more still works within the filtered result. CSV export
  respects the active `q` and `entity_type`.
- No regression: entity filter, pagination, export, empty states still work.
- Verified against a **COPY of the live DB** (with real activity rows — varied users,
  entity names, JSON details) — no errors, no column/index errors.
