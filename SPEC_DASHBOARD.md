# Glance — Dashboard / Analytics Home View

Add a **Dashboard** as the new home view (`/`) with analytics and charts, replacing the plain project list as the landing page. Keep the project list accessible (e.g. via a "Projects" nav item or a link on the dashboard).

## Backend: new analytics endpoint
Add `GET /api/analytics` (authenticated) in a new `backend/routes/analytics.js` (mounted at `/api/analytics` in server.js). Return aggregated data:
```json
{
  "summary": {
    "projects": <count>,
    "tasks": <count>,
    "tasksDone": <count>,
    "tasksInProgress": <count>,
    "tasksTodo": <count>,
    "overdueTasks": <count>,
    "members": <count>
  },
  "tasksByStatus": [ { "status": "todo", "count": n }, ... ],
  "tasksByPriority": [ { "priority": "high", "count": n }, ... ],
  "workloadByMember": [ { "user_id": 1, "name": "Alice", "tasksAssigned": n, "tasksDone": n }, ... ],
  "projectProgress": [ { "project_id": 1, "name": "X", "progress": 45, "tasks": n, "done": n }, ... ],
  "overdueTasks": [ { "id": 1, "title": "Y", "project_name": "X", "due_date": "...", "assignee_name": "..." }, ... ],
  "recentActivity": [ { "id": 1, "title": "Z", "project_name": "X", "status": "done", "updated_at": "..." }, ... ]
}
```
- overdueTasks: tasks with `due_date < today` and `status != 'done'` and `archived = 0`.
- recentActivity: most recently updated tasks (limit ~8), with project name.
- workloadByMember: tasks assigned per user (JOIN users), with done count.
- Use SQLite aggregate queries (COUNT, GROUP BY, JOIN).

## Frontend: Dashboard page
- New `frontend/src/pages/DashboardPage.jsx` (+ `DashboardPage.css`).
- Make it the home route (`/`) in `App.jsx`. Move the project list to `/projects` (update the icon rail "Home" → dashboard, and add a "Projects" nav item or keep project list reachable).
- **Layout:**
  - **Summary stat cards** (grid): Total Projects, Total Tasks, To Do, In Progress, Done, Overdue, Members — each a glassmorphism card with a neon icon + count.
  - **Charts** (pure CSS/SVG, no heavy chart lib):
    - Tasks by Status — horizontal bar or donut (neon colors: todo=cyan, in_progress=amber, done=green).
    - Tasks by Priority — bar (high=red, medium=amber, low=green).
    - Workload by Member — horizontal bars (tasks assigned per member).
    - Project Progress — progress bars per project.
  - **Overdue Tasks** — list with red highlight.
  - **Recent Activity** — list of recently updated tasks.
- Keep the Neon Cyberpunk theme (glassmorphism cards, neon accents, Orbitron headings).
- Clicking a project/task in the dashboard navigates to it.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Backend: new analytics route (read-only, no data changes). No schema changes.
- Preserve all existing functionality (project list still works at /projects).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Verify backend boots and `/api/analytics` returns data.
- Report what you changed.

## Deliverables
- `/api/analytics` endpoint with summary, charts data, overdue, recent activity.
- DashboardPage as home view with stat cards + charts + lists.
- Project list moved to /projects.
- Build passes; backend boots.
