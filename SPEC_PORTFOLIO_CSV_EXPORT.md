# SPEC — Portfolio Page: Export CSV

## Objective
Add an **Export CSV** button to the Portfolios & Programs page (`frontend/src/pages/PortfolioPage.jsx`) so users can download a CSV of all visible projects, including their portfolio/program membership. This closes the CSV-export parity gap: Project List, Project Detail, My Tasks, and Activity Log already have an Export CSV button; the Portfolio page is the only project-management page without one.

**Frontend-only.** No backend change, no DB schema/migration change, no new dependencies.

## Assumptions (verified in repo, main branch)
- Backend `GET /api/projects` (`backend/routes/projects.js`) already returns for each project (single fetch, consumed by `useUI()`):
  `id, name, description, color, status, archived, start_date, due_date, owner_id, owner_name, priority, progress, tags, tagList (array of {id,name}), program_id, portfolio_id, taskCounts: { todo, in_progress, done, overdue }, created_at`.
- `frontend/src/pages/PortfolioPage.jsx` gets `const { portfolios, programs, projects, refreshPortfolios, refreshProjects } = useUI();`. `projects` is the full `/api/projects` payload above (from `UIContext.jsx` `refreshProjects`). `portfolios` carry `id, name, color, projectCount`; `programs` carry `id, name, portfolio_id, color, projectCount`.
- Existing CSV export pattern to mirror is `frontend/src/pages/ProjectListPage.jsx` `handleExportCsv` (~lines 88-132): an `escape` helper (double-quotes any value containing `" , \n \r`), a `header` array joined with `,`, rows `[].map(escape).join(',')`, joined with `\n`, `Blob([csv], { type: 'text/csv;charset=utf-8' })`, `URL.createObjectURL`, a temporary `<a download>` click, then revoke. Reuse this exact pattern.
- PortfolioPage already imports `useState` and `useAuth`/`useUI`. The page header is `.page-header` with `<h1>Portfolios & Programs</h1>` and (when `canEdit`) a `+ New Portfolio` button. The Export button should sit in that header next to the New Portfolio button, consistent with other pages.

## Scope — touch ONLY
- `frontend/src/pages/PortfolioPage.jsx`
- `frontend/src/pages/PortfolioPage.css` (only if a class is genuinely needed; prefer existing `.btn-ghost`)

Do NOT touch backend, db, other components/pages, package.json. No drive-by refactors. Keep all existing portfolio/program/modal/assign behavior intact.

## Behavior
Add an `Export CSV` button in the `.page-header` (right side, next to `+ New Portfolio`) using the existing `btn-ghost` class. Clicking downloads `portfolios-<YYYY-MM-DD>.csv` containing **all `projects` from `useUI()`** (the full list — do not dedupe; include every project).

CSV columns (header row, then one row per project):
- `name`
- `status` (map `active/on_hold/completed/archived` → `Active/On Hold/Completed/Archived`; unknown → raw value)
- `priority`
- `progress`
- `owner`
- `portfolio` (name of the project's portfolio — look up in `portfolios` by `project.portfolio_id`; empty string if none)
- `program` (name of the project's program — look up in `programs` by `project.program_id`; empty string if none)
- `start_date`
- `due_date`
- `open_tasks` (`taskCounts.todo + taskCounts.in_progress`, or empty if no taskCounts)
- `overdue_tasks` (`taskCounts.overdue`, or empty)
- `tags` (join `tagList` names with `; `, else `tags` string)
- `created_at`

Use the same `escape` function as ProjectListPage (null/undefined → `''`; wrap in quotes when containing `" , \n \r`, doubling internal quotes).

## Success criteria
- `cd frontend && npm run build` exits 0.
- Clicking Export CSV downloads `portfolios-<date>.csv` with the header row + one row per project.
- Portfolio and program columns reflect each project's membership (correct names; empty string when unassigned).
- CSV is properly escaped (projects with commas/quotes in names are quoted correctly).
- All existing Portfolio page functionality (portfolios, programs, assignment dropdowns, modals) is unchanged — no regression.
- Verified against a COPY of the live DB (real projects with assorted portfolio/program assignments and tag data) — no errors.

## Constraints
- Frontier: do NOT hand-edit source files directly — implement via the coding agent (OpenCode).
- Do NOT edit backend files or `backend/db.js`. No destructive or DB-writing commands.
- Keep changes minimal and confined to the two frontend files listed.
