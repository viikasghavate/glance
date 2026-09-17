# SPEC — Project List CSV Export

## Objective
Add an "Export CSV" button to the Project List page (`/projects`, `frontend/src/pages/ProjectListPage.jsx`) so a user can download the currently-visible (filtered + sorted) list of projects as a CSV file. This closes the CSV-export parity gap: Project Detail, My Tasks, and Activity Log already have CSV export; the Project List does not.

**Frontend-only.** No backend change, no DB/schema change, no new dependencies.

## Assumptions (verified in repo, main branch)
- `frontend/src/pages/ProjectListPage.jsx` loads the full project list from the UIContext (`useUI()` → `projects`) into memory and applies client-side `search`, `statusFilter`, and `sortBy`/`sortDir` filters via a `filteredProjects` array (a `.filter(...).sort(...)` chain).
- Each project object (`p`) carries: `id, name, description, color, archived, status, start_date, due_date, owner_id, owner_name, owner_email, priority, progress, tags, program_id, portfolio_id, tagList (array of {id,name}), taskCounts {todo, in_progress, done, overdue}, created_at, updated_at`.
- The page already has an `.page-header` block with an `<h1>Projects</h1>` and an `openNewProjectModal` `<button className="btn-primary">` (roughly line 140-143). Place the Export button in that header row, next to the New Project button.
- Existing CSV export pattern to mirror (from `ProjectDetailPage.jsx` `handleExportCsv`): build CSV rows as strings, join with `\n`, build a Blob with `type: 'text/csv;charset=utf-8'`, create an object URL, create a temporary `<a download>` element, click it, then revoke the object URL. No headers/escaping library — escape fields (wrap in quotes if they contain comma/quote/newline; double internal quotes).
- `apiFetch` is NOT needed here — all data is already in `projects`. Pure client-side.
- CSS: reuse existing `.btn-ghost` in the header (no new classes strictly required; a small `margin-left` on the button via inline style or an existing utility is fine if spacing is off).

## Scope — touch ONLY
- `frontend/src/pages/ProjectListPage.jsx`

Do NOT touch backend, db.js, server.js, UIContext, other components/pages, package.json. No drive-by refactors. Preserve the existing search/status-filter/sort behavior and the card grid.

## Behavior
1. Add an "Export CSV" button in the `.page-header` row (next to the New Project button), class `btn-ghost`, labeled "Export CSV".
2. On click, export the **currently filtered & sorted** `filteredProjects` (respect the active search, status filter, and sort — exactly what the user currently sees) as a CSV with columns:
   - `name, status, priority, progress, owner, start_date, due_date, open_tasks, overdue_tasks, tags, created_at`
   - Map: `owner` = `p.owner_name || ''`; `open_tasks` = `p.taskCounts.todo + p.taskCounts.in_progress` (or `p.taskCounts ? (todo+in_progress) : ''`); `overdue_tasks` = `p.taskCounts.overdue`; `tags` = join `p.tagList.map(t => t.name)` with `; ` (fallback to `p.tags` string if `tagList` absent); dates/created_at as raw strings.
   - Filename: `projects-export.csv` (or `projects-YYYY-MM-DD.csv`).
   - Status display value: use `statusLabels[p.status] || p.status` for human-readable "Active"/"On Hold"/"Completed"/"Archived".
3. If `filteredProjects` is empty, the button should still work and produce a CSV with just the header row (harmless), OR disable the button when there are no projects. Prefer: keep enabled, export header-only — simplest, matches "respect what user sees".

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. On the `/projects` page, an "Export CSV" button appears in the header. Clicking it downloads a `projects-*.csv` whose rows match the **current** search/status-filter/sort (e.g. filtering to only "Active" projects yields only Active rows in the CSV).
3. CSV is valid (opens in a spreadsheet / `,\n` delimiters correct; fields with commas/quotes escaped).
4. Existing Project List functionality unchanged: search, status filter, sort, New Project modal, card grid, Copy Project Link, Edit/Archive/Delete all still work.

## Constraints
- Do NOT edit any file other than `frontend/src/pages/ProjectListPage.jsx`.
- Frontend-only; no API/backend changes.
- No new npm dependencies.
- No secrets, no destructive commands.
