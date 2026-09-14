# Project List Search + Filter (small, self-contained UI increment)

## Objective
Add client-side **search and status filtering** to the Project List page so users can
quickly find a project by name/owner and view only Active / On Hold / Completed /
Archived projects. Pure frontend change — no backend or DB schema changes.

## Assumptions
- Backend `/api/projects` already returns name, description, owner_name, status,
  archived, priority, tags, progress, taskCounts for every project (single fetch).
- The full project list is already loaded in memory on the Project List page
  (`frontend/src/pages/ProjectListPage.jsx` + `UIContext`), so filtering can be
  done client-side without extra API calls.
- Status semantics: `p.status` is one of `active`/`on_hold`/`completed`, and
  `p.archived` is a boolean. The page already has a `statusLabels` map.
- Existing design system: CSS vars (`--cyan`, `--border`, `--radius-lg`, `--glow-*`,
  `--bg-hover`), `badge badge-<tone>`, `btn-ghost btn-sm`, `btn-primary`.
  Keep the same look — no new theme.

## Scope
### In
- A search text input in the page header area filtering projects by name OR owner
  name OR description (case-insensitive substring).
- A status filter (dropdown or segmented control) with options: All, Active,
  On Hold, Completed, Archived. Matches on `p.status` for the first three and
  `p.archived` for Archived.
- Empty-state when the filter yields no results ("No projects match your filters").
- Small, consistent CSS additions in `ProjectListPage.css` (search input + filter
  control styling aligned with existing tokens).
### Out
- No backend changes, no API changes, no DB schema/migration changes.
- No sorting/pagination (not requested).
- No persistence of the filter value across reloads.

## Success Criteria
1. Typing in the search box narrows the visible project cards live (no reload).
2. Selecting a status filter shows only matching projects (and combines with search).
3. Archived projects only appear when "Archived" is selected.
4. Combined search+filter returns the intersection.
5. `npm run build` in `frontend/` passes with no errors.
6. No regressions to the existing project list rendering (cards, counts, actions).

## Constraints
- Do **not** edit backend files or `backend/db.js`. Do not run any destructive or
  DB-writing commands.
- Follow the existing React/JSX style (function components, `useAuth`/`useUI` hooks,
  CSS modules are plain `.css` files).
- Keep changes minimal and readable; avoid rewriting unrelated code.

## Verification
- `cd frontend && npm run build` exits 0.
- Manual/logic check: the filter code composes correctly (empty search = all; empty
  filter = all; both present = intersection).
