# Sprint + Milestone Progress Bars (small, self-contained increment)

## Objective
Show how much work remains in each Sprint and Milestone by adding a **done/total
count and progress bar** to the existing Sprint and Milestone collapsible sections
on the Project Detail page. Helps users spot at a glance which sprint/milestone is
stalled vs. nearly complete.

## Assumptions
- Backend already returns every sprint and milestone with a `task_count` field
  (total non-deleted tasks linked to it):
  - `backend/routes/sprints.js` — `getSprint()` and the list route both SELECT
    `(SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.deleted_at IS NULL) as task_count`.
  - `backend/routes/milestones.js` — same pattern with `milestone_id`.
- Tasks have a `status` column with values `todo` / `in_progress` / `done`.
- Frontend renders sprints in `frontend/src/components/SprintSection.jsx` and
  milestones in `frontend/src/components/MilestoneSection.jsx`. Both already show
  `<span className="sprint-count">{s.task_count} tasks</span>` / `{m.task_count} tasks`.
- Existing design tokens: `--cyan`, `--success`, `--warning`, `--border`,
  `--radius-*`, `badge badge-<tone>` (see `frontend/src/index.css`). Keep the same
  look — no new theme.

## Scope
### In
- Backend (read-only query change, no schema/migration): add a `done_count` field
  alongside every existing `task_count` in BOTH sprint and milestone payloads
  (the `getX(id)` singleton and the list routes in `backend/routes/sprints.js` and
  `backend/routes/milestones.js`). `done_count` = count of non-deleted tasks with
  `status = 'done'`.
- Frontend: in `SprintSection.jsx` and `MilestoneSection.jsx`, under the count,
  render a small progress bar + "done/total" label derived from `done_count` /
  `task_count`. Handle `task_count === 0` (show empty bar / no progress, no
  division-by-zero).
- A few CSS rules appended to `SprintSection`/`MilestoneSection` styles (they share
  `.sprint-*` classes; add a `.progress-bar` + `.progress-fill` style consistent with
  existing tokens).
### Out
- No DB schema / migration changes. No API route additions (only existing payloads).
- No sorting / persistence / filtering changes.
- Do NOT touch the Task/Kanban/List views.

## Success Criteria
1. `GET /projects/:id/sprints` and `GET /projects/:id/milestones` each return
   `done_count` per item, and `done_count <= task_count` always.
2. Sprint/Milestone sections render "X / Y done" and a progress bar whose fill
   width = `done_count / task_count` (0 when task_count is 0).
3. A 100%-done sprint/milestone shows a fully filled (success-colored) bar;
   a 0-done shows an empty bar.
4. `cd frontend && npm run build` exits 0 with no errors.
5. No regressions to the existing sprint/milestone create/edit/delete/complete
   flows (the new fields are additive).

## Constraints
- Do **not** edit `backend/db.js`. Do not run destructive or DB-writing commands.
- Follow existing React/JSX style (function components, `apiFetch`, plain `.css`).
- Keep changes minimal and readable; avoid rewriting unrelated code.
- The change is fully backwards-compatible: older cached payloads lacking
  `done_count` should degrade gracefully (show no bar / treat as 0).

## Verification
- `cd frontend && npm run build` exits 0.
- Quick node check that the two route queries return `done_count` using a
  COPY of the live DB (see project runbook — never run against the live DB).
- Logic check: `pct = task_count ? Math.round((done_count/task_count)*100) : 0`;
  fill width uses `pct` clamped 0..100.
