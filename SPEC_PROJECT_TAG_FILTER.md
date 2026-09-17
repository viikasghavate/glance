# SPEC — Project Tag Filter on Project List (+ tagList shape fix)

## Objective
Projects already carry tags end-to-end (free-text `projects.tags` kept in sync with the
normalized `tags` / `project_tags` tables by `backend/services/tagging.js`), and the tag
chips already render on the project cards. But the Project List page has **no way to filter
by tag**, even though it filters by search + status. Make tags a first-class filter, and fix
a real prod-visible bug found while verifying: both project CSV exports write the tags column
from `p.tagList` as if it were an array of objects, so live exports currently emit
`undefined; undefined`.

## Assumptions / current state (verified against the repo and live data)
- `GET /api/projects` returns each project with `tagList: string[]` — `getProjectTags()` in
  `backend/services/tagging.js` does `rows.map(r => r.name)`, i.e. **an array of plain strings**.
  Verified live: 14 tags, 30 `project_tags` links, 16 non-deleted projects.
- **Bug:** `frontend/src/pages/ProjectListPage.jsx` (~line 104) and
  `frontend/src/pages/PortfolioPage.jsx` (~line 76) both do
  `p.tagList.map(t => t.name).join('; ')`. On a `string[]` this yields `undefined; undefined`.
  Confirmed by inspection of the shared helper's return shape.
- `ProjectListPage.jsx` already has a client-side filter pipeline (search + status) inside
  `filteredProjects`, plus a client-side sort and a CSV export of the filtered rows.
  `SPEC_PROJECT_FILTER.md` establishes the house pattern: filter **client-side**, no extra fetch.
- The project cards render chips from the raw `p.tags` comma string (`p.tags.split(',')`).
- Precedent for deriving a filter's option list client-side from the loaded set (rather than a
  network call) is `SPEC_TASK_LABEL_FILTER.md` / `TaskList.jsx` `distinctLabels`.
- House style: neon-dark theme, page-scoped CSS, reuse `.project-status-filter` for filter
  controls, `btn-ghost btn-sm` for the clear button. `SPEC_PROJECT_VIEW_CLEAR_FILTERS.md`
  defines the "Clear filters"/`anyFilter` pattern (button rendered ONLY when a control is
  non-default), as implemented in `MyTasksPage` and `TimeLogPage`.
- Engine gotcha: prod runs `DB_ENGINE=pg` (Postgres) via `backend/pg/client.js`; the sqlite
  path is the default for local. **This feature adds no SQL**, so no engine-specific code.

## Scope

### In — `frontend/src/pages/ProjectListPage.jsx` (primary)
1. **Tag filter state:** `const [tagFilter, setTagFilter] = useState('');` (empty = All Tags).
2. **Tag option list (client-side):** derive `distinctTags` from the loaded `projects`:
   - Normalize each project's tags with a small local helper `projectTagNames(p)` that accepts
     BOTH shapes defensively and always returns a clean `string[]`:
     - `p.tagList` entries may be strings (current backend) or `{name}` objects (historical),
       so map `typeof x === 'string' ? x : (x && x.name)`.
     - Fall back to splitting `p.tags` on `,` when `tagList` is absent/empty.
     - Trim, drop empties, de-duplicate.
   - `distinctTags` = union across all loaded projects, case-insensitively de-duplicated,
     sorted alphabetically (locale-aware `localeCompare`).
3. **Filter control:** a `<select className="project-status-filter">` labelled for tags with an
   `All Tags` option (`value=""`) followed by the distinct tags, placed immediately after the
   existing status filter and before the sort control. Include an `aria-label` (e.g. "Filter by tag").
4. **Apply the filter:** inside `filteredProjects`, AND a tag condition with the existing search
   and status conditions. A project matches when `projectTagNames(p)` contains the selected tag
   (case-insensitive compare). `tagFilter === ''` matches everything.
5. **Clear filters:** add a `Clear filters` button (reusing the `btn-ghost btn-sm` styling and the
   MyTasksPage pattern) that resets `search`, `statusFilter` back to `'all'`, `tagFilter` back to
   `''`, `sortBy` back to `''` and `sortDir` back to `'asc'`. Render it ONLY when at least one of
   those controls is non-default (`anyFilter`).
6. **Fix the CSV export tags column:** replace `p.tagList.map(t => t.name)` with the normalized
   `projectTagNames(p).join('; ')` so the exported `tags` column contains real names
   (e.g. `backend; infra`) instead of `undefined; undefined`.
7. **Card chips consistency:** render the card tag chips from the same normalized
   `projectTagNames(p)` (instead of `p.tags.split(',')`) so chips and the filter agree
   (trimmed, de-duplicated, no empty chips).

### In — `frontend/src/pages/PortfolioPage.jsx` (same bug, one line)
- Apply the identical `tagList` shape normalization in its CSV export so portfolio exports also
  emit real tag names. Keep the change minimal and local; do not restructure that page.

### In — `frontend/src/pages/ProjectListPage.css`
- Only if needed: minimal styling so the new clear button sits consistently with the existing
  `.project-filters` toolbar. Reuse existing tokens/classes; no new theme, no global CSS edits.
  If `.project-status-filter` already styles the select correctly, add nothing.

### Out of scope (do NOT touch)
- **No backend changes at all.** `GET /api/tags` and `GET /api/projects?tag=` are left exactly as
  they are (they stay available to API consumers); the page filters client-side per house pattern.
- No schema/migration, no new dependency, no new route, no nav entry.
- Do not touch `tasks`/`labels` or `labelList` handling in `TaskList`/`KanbanBoard`/`TimelineView`
  (a parallel shape question exists there; it is deliberately out of scope for this change).
- Do not change search, status, sort semantics, the delete/copy-link actions, or the
  `UIContext` project fetch.
- No reformatting of untouched code; no drive-by refactors.

## Success criteria
1. A Tag dropdown appears in the Project List toolbar with `All Tags` as the default, listing the
   distinct tags of the loaded projects alphabetically.
2. Selecting a tag shows only projects carrying it, and it composes (AND) with the existing search
   and status filters.
3. `Clear filters` appears only when something is non-default and resets search, status, tag and sort.
4. The exported project CSV `tags` column contains real tag names — **never** `undefined`.
5. The portfolio CSV export `tags` column likewise contains real tag names.
6. Project cards still render their tag chips correctly (no empty chips, no duplicates).
7. `cd frontend && npm run build` exits 0 with no new warnings.
8. No backend file is modified (`git diff --name-only` contains only the three frontend files
   at most).

## Verification (must be performed, not asserted)
- `cd frontend && npm run build` passes.
- Prove the shape fix against **real live data** (do not just reason about it): confirm the live
  API projects' `tagList` is a `string[]` (e.g. by reading the live Postgres database in
  `/home/ubuntu/projects/glance/.pg/glance-pg.env` read-only, or by starting the backend against
  a **copy** of the live data) and show that the OLD expression produced `undefined; undefined`
  while the NEW normalized helper produces the real names for a project that has tags.
- Show the tag-filter predicate returns the expected subset for at least one real tag
  (e.g. count projects carrying `backend`).
- Never run destructive commands; never mutate live data (read-only queries only).

## Constraints (Karpathy principles)
- Simplest thing that works; smallest possible diff.
- Reuse existing helpers, classes and patterns instead of adding parallel machinery.
- Every change must be justified by a success criterion above.
- Do not hand-edit build output.
