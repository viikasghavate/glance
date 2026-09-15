# SPEC — Timeline (Gantt) view: recurring + blocked badges

## Objective
The Timeline/Gantt view is the only task surface that does NOT show the **recurrence** (↻) and **blocked-by-incomplete-dependency** (⛔) badges. KanbanBoard and TaskList already render both. Add the same badges to the Timeline view's `timeline-task-meta` area so scheduling context is consistent across all three views.

## Current state
- `frontend/src/components/TimelineView.jsx` renders each task row's meta at `~line 270-290`:
  ```jsx
  <span className="timeline-task-meta">
    <span className={`badge badge-${task.priority}`}>{task.priority}</span>
    <span className="timeline-status" ...>{STATUS_LABELS[task.status] || task.status}</span>
    {task.assignee_id && (<span className="timeline-assignee" ...>{getInitials(...)}</span>)}
  </span>
  ```
- Task objects passed to `<TimelineView tasks={...}>` come from `GET /api/tasks/project/:projectId` in `backend/routes/tasks.js`, which already maps `getDependencies(t.id)` (adding `blockedBy`/`blocks`) and includes `t.*` (so `recurrence` present). No backend change needed.
- Existing badge markup + CSS to mirror:
  - KanbanBoard.jsx ~229: `<span className="recurrence-badge" title={`Recurring: ${task.recurrence}`}>↻</span>`
  - KanbanBoard.jsx ~232: `{task.blockedBy && task.blockedBy.some(d => d.status !== 'done') && (<span className="blocked-badge" title="Blocked by incomplete dependencies">⛔</span>)}`
  - TaskList.css defines `.recurrence-badge` and `.blocked-badge` (shared).

## Scope — touch ONLY
- `frontend/src/components/TimelineView.jsx` — add the two badges into `timeline-task-meta`, immediately after the assignee initials (mirror Kanban order: priority, status, recurrence, blocked, assignee is fine — match closest sensible position). Use the SAME class names (`recurrence-badge`, `blocked-badge`) already styled in TaskList.css so no CSS change is required.

Do NOT touch any other file. No backend changes. No refactors.

## Success criteria
- After `npm run build`, the served bundle contains the `recurrence-badge`/`blocked-badge` markup inside the Timeline view.
- Recurring tasks (recurrence !== 'none') show the ↻ badge in Timeline.
- Tasks blocked by an incomplete dependency show the ⛔ badge in Timeline.
- Kanban + List badges unchanged (regression check via build only).
