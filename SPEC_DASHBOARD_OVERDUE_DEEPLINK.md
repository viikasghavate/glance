# SPEC — Dashboard Overdue Tasks deep-link to the specific task

## Objective
On the Dashboard, each row in the **Overdue Tasks** panel currently navigates only to
the project page (`/project/<id>`). Make each row deep-link straight to its task:
`/project/<id>?task=<taskId>`, so the user lands on the overdue record directly with
its detail modal open — matching the behavior already shipped for Global Search results
and the Copy Task Link button.

## Assumptions / current state (verified)
- `frontend/src/pages/ProjectDetailPage.jsx` already reads the `?task=<id>` query param
  (`useSearchParams`), finds the task in `tasks`, opens the `TaskDetailModal`, and clears
  the param. This mechanism is proven — Global Search and Copy Link use it.
- The Dashboard Overdue Tasks panel (`frontend/src/pages/DashboardPage.jsx`) renders:
  ```jsx
  <Link key={t.id} to={`/project/${t.project_id}`} className="task-row overdue">
  ```
  and maps rows from `data.overdueTasks`, each of which already carries `t.id` and
  `t.project_id` (from `backend/routes/analytics.js` overdueList SELECT).
- The top-bar global search deep-link format is `/project/${t.project_id}?task=${t.id}`.

## Scope — touch ONLY
- `frontend/src/pages/DashboardPage.jsx` (single `to` attribute change).

Do NOT touch backend, analytics.js, ProjectDetailPage, Layout, or any other file.

## Change
- In `DashboardPage.jsx`, change the Overdue Task `<Link>` `to` from:
  `\`/project/${t.project_id}\``
  to:
  `\`/project/${t.project_id}?task=${t.id}\``

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. Clicking an overdue row in the Dashboard navigates to the project page with the
   detail modal for that specific task open.
3. No other Dashboard behavior changes (only the overdue panel `to` value changes).
4. `git status` shows only `DashboardPage.jsx` (and this spec file) changed.

## Constraints
- One-character-scope edit; do not reformat or refactor the file.
- Do NOT hand-edit — implement via the OpenCode agent.
- No backend/schema changes. No destructive commands.
