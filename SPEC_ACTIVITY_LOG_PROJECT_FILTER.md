# SPEC — Activity Log: Filter by Project

## Objective
Let users scope the Activity Log to a single project. `GET /api/activity` and
`GET /api/activity/export` already accept a `project_id` query param
(`backend/routes/activity.js`, both handlers), but **no frontend surface ever sends it**
— verified: `grep -rn "project_id" frontend/src/pages/ActivityLogPage.jsx` → no hits.
The page filters by entity type, actor and date range only. An admin auditing
"what happened in the Mobile App Launch project this sprint?" has no way to do it.
This closes that last filter gap on the page.

**Frontend-only.** No backend change, no schema/migration change, no new dependencies.

## Assumptions (verified in repo, main branch)
- `backend/routes/activity.js` — both `GET /` and `GET /export` already read
  `project_id` and apply `a.entity_type = 'task' AND t.project_id = ?`, composing AND
  with the existing `entity_type`, `q`, `user_id`, `from`, `to`, `limit` filters.
  The `project_id` branch is already covered by the JOIN of `tasks t` in the SELECT.
  **Do not modify this file.**
- `frontend/src/pages/ActivityLogPage.jsx` state: `rows, loading, loadingMore, error,
  users, userId, fromDate, toDate, entityType, query, debouncedQuery, limit, hasMore,
  exporting`, plus `prevEntityRef/prevQueryRef/prevUserIdRef/prevFromRef/prevToRef`.
- `load(type, reset)` builds a `URLSearchParams` with `limit` + `entity_type` + `q` +
  `user_id` + `from` + `to`, and `handleExportCsv` mirrors the same params into
  `/api/activity/export`. Both must forward `project_id`.
- The page already fetches `apiFetch('/users')` on mount into `users`. Mirror that
  exactly for projects with `apiFetch('/projects')` (returns `[{ id, name, ... }]`,
  archived filtered by the backend).
- `ENTITY_FILTERS` renders the entity-type `<select>`; the actor `<select>` renders
  `All Users` + one `<option>` per user. Copy that markup for projects.
- Reset detection is the ref-compare block inside the `useEffect` that calls
  `load(entityType, reset)`; each filter change handler also does `setLimit(PAGE_SIZE)`.

## Scope — touch ONLY
- `frontend/src/pages/ActivityLogPage.jsx`
- `frontend/src/pages/ActivityLogPage.css` (only if a class is genuinely needed —
  the existing `.activity-filter-select` should be reused)

Do NOT touch backend, db, other pages/components, package.json. No drive-by refactors.

## Behavior
1. New state `const [projectId, setProjectId] = useState('');`
2. New fetch effect: `apiFetch('/projects')` → `setProjects(Array.isArray(d) ? d : [])`,
   `.catch(() => {})`, deps `[apiFetch]` — identical shape to the existing users fetch.
3. New `<select className="activity-filter-select" value={projectId}
   onChange={handleProjectChange}>` with a first `<option value="">All Projects</option>`
   and one option per project (`key={p.id} value={p.id}` → `p.name`). Place it
   immediately after the actor (`All Users`) select.
4. `handleProjectChange`: `setLimit(PAGE_SIZE); setProjectId(e.target.value);`
5. `load()`: add `if (projectId) params.set('project_id', projectId);` and add
   `projectId` to the `useCallback` dep array.
6. Reset detection: add a `prevProjectRef` ref, include `projectId !== prevProjectRef.current`
   in the `reset` expression, assign `prevProjectRef.current = projectId` alongside the
   other assignments, and add `projectId` to that effect's dep array.
7. `handleExportCsv`: add `if (projectId) params.set('project_id', projectId);`
   so the CSV matches the visible filtered set (backend `/export` already supports it).

## Success Criteria
1. The Activity Log page renders an `All Projects` + per-project dropdown.
2. Selecting a project re-loads the list scoped to that project's task activity
   (fewer rows than unfiltered; every returned row has `entity_type === 'task'`).
3. Clearing back to `All Projects` restores the full list.
4. `Export CSV` while a project is selected downloads an `activity-log.csv` whose
   rows correspond to the project-scoped set.
5. Existing filters (search, entity type, user, from/to dates) still compose with the
   project filter — no regression.
6. `npm run build` in `frontend/` exits 0; backend boots clean.

## Constraints
- Implement via the OpenCode coding agent (`~/.opencode/bin/opencode`) — never hand-edit source.
- Keep prod healthy; no destructive operations, no new deps.
- Match existing markup/class conventions exactly; keep the diff small and readable.
