# Glance — Add Label / Priority / Assignee Filters to Timeline (Gantt) View

## Objective
Add **label, priority, and assignee filters** to the Timeline (Gantt) view so users can narrow
tasks the same way they already can in the List (`TaskList.jsx`) and Kanban
(`KanbanBoard.jsx`) views. Today the Timeline view (`TimelineView.jsx`) renders every task
with NO filter controls — the only view missing them. This closes that parity gap.
Frontend-only — no backend or DB changes, no schema change.

## Assumptions (verified in repo)
- `frontend/src/components/TimelineView.jsx` receives `{ tasks, users, onTaskClick }` from
  `ProjectDetailPage.jsx` (`<TimelineView tasks={visibleTasks} users={users} onTaskClick={setSelectedTask} />`).
- Tasks carry `labels` (comma-separated string, may be null/empty), `priority`
  (`low|medium|high`), and `assignee_id`. `users` is an array of `{ id, name, ... }`.
- The existing filter patterns to mirror:
  - **Kanban** (`KanbanBoard.jsx`): state `filterLabel`/`filterPriority`/`filterAssignee`
    (default `''`); `distinctLabels` useMemo builds a sorted set from `t.labels.split(',')`;
    then `.filter(t => !filterLabel || (t.labels ? t.labels.split(',').map(l => l.trim().toLowerCase()) : []).includes(filterLabel.toLowerCase()))`,
    `.filter(t => !filterPriority || t.priority === filterPriority)`,
    `.filter(t => !filterAssignee || String(t.assignee_id) === filterAssignee)`.
  - **List** (`TaskList.jsx`): same three filter selects rendered in a `.task-filters` bar
    (`<select ...><option value="">All Labels</option>{distinctLabels.map(l => <option key={l} value={l}>{l}</option>)}</select>`,
    priority options `All Priorities | Low | Medium | High`, assignee options from `users`
    `<option key={u.id} value={u.id}>{u.name}</option>`).

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx`
- `frontend/src/components/TimelineView.css`

Do NOT touch backend, db, ProjectDetailPage, KanbanBoard, TaskList, or any other component.

## Frontend — TimelineView.jsx
1. **Add state** (top of component, alongside `todayLeft`):
   - `const [filterLabel, setFilterLabel] = useState('');`
   - `const [filterPriority, setFilterPriority] = useState('');`
   - `const [filterAssignee, setFilterAssignee] = useState('');`
2. **Add `distinctLabels` useMemo** (copy the KanbanBoard pattern verbatim):
   ```js
   const distinctLabels = useMemo(() => {
     const set = new Set();
     tasks.forEach(t => {
       if (t.labels) {
         t.labels.split(',').forEach(l => {
           const v = l.trim();
           if (v) set.add(v);
         });
       }
     });
     return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
   }, [tasks]);
   ```
3. **Filter tasks before grouping.** The timeline groups are computed inside the main
   `useMemo` from `tasks` (the `tasksWithDates` / `tasksWithoutDates` / `labelMap` / `sortedGroups`
   logic, currently with `[tasks]` as the dependency). Compute a `filteredTasks` first, then
   feed THAT into the grouping memo:
   - Add, before the `useMemo` (or inside it on a filtered copy):
     ```js
     const filteredTasks = tasks.filter(t =>
       (!filterLabel || (t.labels ? t.labels.split(',').map(l => l.trim().toLowerCase()) : []).includes(filterLabel.toLowerCase())) &&
       (!filterPriority || t.priority === filterPriority) &&
       (!filterAssignee || String(t.assignee_id) === filterAssignee)
     );
     ```
   - Replace every use of `tasks` **inside the grouping memo** with `filteredTasks`
     (i.e. `tasksWithDates = filteredTasks.filter(...)`, `tasksWithoutDates = filteredTasks.filter(...)`,
     the depth-walk `tasks.find(...)` in `getDepth` may keep using `tasks` — but to keep the
     dependency array correct, make `filteredTasks` a plain const computed each render and add
     `filterLabel, filterPriority, filterAssignee` to the memo dependency array so the groups
     recompute when a filter changes). Simplest correct approach: compute `filteredTasks` as a
     normal const outside the memo, and change the memo dependency array to
     `[filteredTasks, filterLabel, filterPriority, filterAssignee]`.
   - Note: do NOT filter the `tasks` the row-drag / depth logic walks — only the grouping input.
4. **Render the filter bar.** Add a filter bar row at the TOP of the returned JSX, inside
   `.timeline-container`, ABOVE `.timeline-scroll` (so it does not scroll with the timeline).
   Reuse the same select patterns as List/Kanban:
   ```jsx
   <div className="timeline-filters">
     <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
       <option value="">All Labels</option>
       {distinctLabels.map(l => (
         <option key={l} value={l}>{l}</option>
       ))}
     </select>
     <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
       <option value="">All Priorities</option>
       <option value="low">Low</option>
       <option value="medium">Medium</option>
       <option value="high">High</option>
     </select>
     <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
       <option value="">All Assignees</option>
       {users.map(u => (
         <option key={u.id} value={u.id}>{u.name}</option>
       ))}
     </select>
   </div>
   ```
   - If no tasks match the active filters, show a small centered empty message inside the
     timeline body (e.g. `<div className="timeline-empty">No tasks match the filters.</div>`),
     matching the List/Kanban empty-filter convention.
5. Keep all existing behavior: grouping by first label, `No Dates` group, today line, bar
   rendering, depth indentation, click-to-open.

## Frontend — TimelineView.css
- Add a `.timeline-filters` style: a horizontal flex row with `gap`, matching the existing
  `.task-filters` / `.kanban-filters` look (reuse the same `select` styling tokens already in
  the app, e.g. `var(--bg-input)`, `var(--border)`, `var(--text-muted)`, radius, padding).
- Add `.timeline-empty` styling (centered, muted text).

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. A label filter narrows the timeline to tasks carrying that label; a priority filter narrows
   by priority; an assignee filter narrows by assignee. Combining filters ANDs the conditions.
3. Filters reset the grouping / date range correctly (when a filter empties all dated tasks,
   the timeline falls back to the default range and shows the empty message if nothing matches).
4. With no filters selected, the timeline renders exactly as before (all tasks, all groups).
5. Only the two listed Scope files changed (`git status`).

## Constraints
- Do NOT edit `backend/**`, `db.js`, `ProjectDetailPage.jsx`, `KanbanBoard.jsx`, `TaskList.jsx`.
- Frontend-only in the two listed files.
- Match the existing filter/select pattern exactly — do not introduce new state mgmt, new
  CSS variables, or a different filter model.
- No secrets, no destructive commands.
