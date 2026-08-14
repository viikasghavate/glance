# Glance — Add MS Project-style Timeline (Gantt) View

Add a **Timeline / Gantt** view to the project detail page, styled like MS Project. It should be a third view option alongside Board and List.

## Current state
- `frontend/src/context/UIContext.jsx` has `view` state ('board' | 'list') and `setView`.
- `frontend/src/components/Layout.jsx` top bar has a Board/List toggle (`view-toggle-top`).
- `frontend/src/pages/ProjectDetailPage.jsx` renders KanbanBoard when `view==='board'`, TaskList when `view==='list'`.
- Tasks have `start_date`, `due_date`, `status`, `priority`, `title`, `labels`, `assignee_id`.

## Goal
Add a **Timeline** view (`view === 'timeline'`) that renders an MS Project-style Gantt chart:
- Left panel: task list (name, status, priority, assignee, dates).
- Right panel: a horizontal timeline with date columns and **bars** for each task spanning start_date → due_date.
- Bars colored by status (todo=gray/blue, in_progress=amber, done=green) — MS Project style.
- A "today" vertical line marker.
- Date header showing months/days across the timeline range.
- Tasks sorted by start_date (or by position). Group by phase/label if labels exist (optional but nice — group tasks by their first label, e.g. planning/prep/upgrade/testing/go-live).

## Implementation
- New component `frontend/src/components/TimelineView.jsx` (+ `TimelineView.css`).
- Add `timeline` to the view toggle in `Layout.jsx` (Board | List | Timeline).
- In `ProjectDetailPage.jsx`, render `<TimelineView tasks={tasks} users={users} onTaskClick={setSelectedTask} />` when `view === 'timeline'`.
- Compute the timeline range from the min start_date and max due_date across tasks (with padding). If no dates, fall back to a sensible default range.
- Pure CSS/JS rendering (no heavy chart library) — use a scrollable container with a fixed left task panel and a horizontally scrollable timeline. Keep it clean and MS Project-like.
- Handle tasks with missing start/due dates gracefully (show them in the list without a bar, or at the top).
- Clicking a task bar/row opens the task detail (reuse `onTaskClick` → `setSelectedTask`).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- No backend changes — this is frontend-only (tasks already have start_date/due_date).
- Preserve existing Board/List views and all functionality.
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report what you changed.

## Deliverables
- TimelineView component + CSS (MS Project-style Gantt).
- View toggle includes Timeline.
- ProjectDetailPage renders Timeline view.
- Build passes.
