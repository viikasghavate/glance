# SPEC — My Tasks: Sprint & Milestone Filters

## Objective
Add **Sprint** and **Milestone** filter dropdowns to the My Tasks page
(`frontend/src/pages/MyTasksPage.jsx`) so users can narrow their assigned tasks by
sprint/milestone — parity with the List, Kanban, and Timeline views, which all already
have these filters. Frontend-only; combine (AND) with the existing status chips, search,
due-filter, priority, assignee, label filters, and sort.

## Assumptions (verified in repo, main branch @ 22921e8)
- Backend `GET /api/tasks/mine` (`backend/routes/tasks.js` route `router.get('/mine', ...)`)
  returns an array of task objects. Each carries (verified in the SQL at the top of the
  `/mine` route): `id, title, description, status, priority, due_date, assignee_id,
  assignee_name, project_name, **sprint_name, milestone_name**, labels (string),
  labelList (array of {id,name}), subtask_count, comment_count, archived, start_date`.
  `sprint_name` / `milestone_name` are **nullable** (LEFT JOIN sprints/milestones).
- `frontend/src/pages/MyTasksPage.jsx` currently has filters: status chips (`filter`),
  search (`search`), sort (`sortBy`/`sortDir`), due (`dueFilter`), priority
  (`priorityFilter`), assignee (`assigneeFilter`), label (`labelFilter`). All combine AND
  inside a `filtered` useMemo. The page already **displays** sprint/milestone badges on
  rows (`.badge.badge-todo` for sprint, `.badge.badge-in_progress` for milestone) but has
  NO dropdowns to filter by them.
- Existing filter bar is a `.page-header` row of `<select>`s near lines 195-230.
- The exact reference pattern to mirror is in `frontend/src/components/TaskList.jsx`:
  - state `const [filterSprint, setFilterSprint] = useState('')` and
    `const [filterMilestone, setFilterMilestone] = useState('')`
  - filtering: `if (filterSprint && t.sprint_name !== filterSprint) return false;` and
    `if (filterMilestone && t.milestone_name !== filterMilestone) return false;`
  - distinct options:
    ```
    const distinctSprints = useMemo(() => {
      const set = new Set();
      tasks.forEach(t => { if (t.sprint_name) set.add(t.sprint_name); });
      return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }, [tasks]);
    ```
    and likewise `distinctMilestones` on `t.milestone_name`.
  - renders:
    ```
    <select value={filterSprint} onChange={e => setFilterSprint(e.target.value)}>
      <option value="">All Sprints</option>
      {distinctSprints.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
    <select value={filterMilestone} onChange={e => setFilterMilestone(e.target.value)}>
      <option value="">All Milestones</option>
      {distinctMilestones.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
    ```

## Scope — touch ONLY
- `frontend/src/pages/MyTasksPage.jsx` — add `filterSprint`/`filterMilestone` state,
  `distinctSprints`/`distinctMilestones` memos, the two AND filters inside the `filtered`
  memo, two `<select>`s in the filter bar (Sprint before Milestone, placed logically near
  the other dropdowns), and add the new state vars to the memo's dependency array.
- Do NOT touch backend, db.js, server.js, other components/pages, overdue.js, TaskList.jsx
  (reference only).
- No CSS changes required — reuse existing `.page-header` select styling.
- No new dependencies.

## Behavior
- `All Sprints` (empty value) = no sprint filtering; `All Milestones` = no milestone filtering.
- Select a sprint → only tasks whose `sprint_name` equals the selection (tasks with
  null/empty sprint excluded). Same for milestone.
- Combine AND with all existing filters (status chip, search, due, priority, assignee,
  label) and then sort applies as today.
- Distinct options come from the fetched `/mine` tasks' `sprint_name`/`milestone_name`
  (non-empty), aphabetically sorted, case-insensitive.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes with no errors.
2. Backend boots (`node backend/server.js` or equivalent) with no errors.
3. Sprint dropdown lists the distinct sprint names present in my assigned tasks; selecting
   one narrows rows to only tasks in that sprint (null-sprint tasks hidden).
4. Milestone dropdown behaves the same.
5. Filters combine correctly with existing chips/search/due/priority/assignee/label and
   sort (AND semantics — no regression).
6. Verified against a COPY of the LIVE DB (real tasks with varied/missing sprint/milestone)
   — no errors, no column/index errors. Empty-sprint/milestone tasks never crash.
7. Only the one file changed (`git status`) — plus this spec file.

## Constraints
- Match the TaskList.jsx pattern exactly (state names, filter logic, option rendering).
- Keep existing behavior intact; no refactors. Do NOT change the backend.
- Test against a copy of the live DB, never the live DB itself.
