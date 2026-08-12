# Glance — ClickUp-Style Layout Redesign

Replicate ClickUp's app shell layout for the Glance project management tool. Keep all existing functionality (projects, tasks, kanban, list, comments, auth) — only restructure the navigation/layout shell.

## ClickUp Layout to Replicate (3-column app shell)

```
┌────┬──────────┬──────────────────────────────────────────────┐
│ 1  │    2     │  3  (top bar)                                │
│ icon│  space/  ├──────────────────────────────────────────────┤
│ rail│  project │  4  (main content)                           │
│     │  nav     │                                              │
│     │          │                                              │
└────┴──────────┴──────────────────────────────────────────────┘
```

### Column 1 — Icon Rail (narrow, ~56-64px wide, dark)
- Vertical stack of icon buttons (SVG icons, no text):
  - **Home** (→ `/`)
  - **Inbox** (placeholder, no-op)
  - **Docs** (placeholder)
  - **Dashboards** (placeholder)
  - **Goals** (placeholder)
  - Spacer
  - **Settings** (placeholder) at bottom
- Active item highlighted (indigo accent). Hover shows tooltip (title attr).
- Collapsible: a collapse toggle at the bottom that hides this rail (optional but nice).

### Column 2 — Space/Project Nav (wider, ~240px, slightly lighter than rail)
- **Header row:** "Glance" workspace name + a **"+ New"** button (opens the create-project modal).
- **"Projects" section label** with a small count.
- **Project list** — each project is a nav item:
  - Colored dot (project.color) + project name
  - Clicking navigates to `/project/:id`
  - Active project highlighted
  - Hover reveals a small "..." or trash icon to delete (optional)
- **"New Project"** link/button at the bottom of the list (also opens modal).
- Collapsible sections (chevron) — optional.

### Column 3 — Top Bar (full width above content, ~48-56px)
- **Left:** breadcrumb — e.g. `Glance / <Project Name>` (or just current page title). On project page show project name; on home show "Projects".
- **Center/right:** 
  - A **search input** (placeholder, non-functional or simple client-side filter)
  - **View toggle** on project page: "Board" | "List" (wire to existing KanbanBoard/TaskList)
  - **User avatar** (circle with initials) + name; clicking shows a dropdown with **Logout**.

### Column 4 — Main Content
- Existing pages render here (ProjectListPage, ProjectDetailPage).
- Content area scrolls independently; sidebar columns are fixed.

## Implementation Notes
- **Files to change:**
  - `frontend/src/components/Layout.jsx` — rewrite to the 3-column shell (icon rail + project nav + top bar + content Outlet).
  - `frontend/src/components/Layout.css` — new styles for the shell.
  - `frontend/src/App.jsx` — keep routes; Layout wraps ProjectListPage and ProjectDetailPage as now.
  - `frontend/src/pages/ProjectListPage.jsx` — the "New Project" button should trigger the existing ProjectModal. Consider lifting the create-project modal state so both the sidebar "+ New" and the page button can open it. Simplest: keep the modal in ProjectListPage, and have the sidebar "+ New" navigate to `/` and open the modal via a shared context or a custom event. **Recommendation:** create a small `UIContext` (or reuse a simple event bus) so the sidebar "+ New" can open the project modal from anywhere. Keep it simple.
  - `frontend/src/pages/ProjectDetailPage.jsx` — add the Board/List view toggle in the top bar (or keep the existing toggle if present; wire it to the top bar).
- **Icons:** use inline SVG (no icon library dependency) — simple, clean line icons (home, inbox, docs, dashboard, target/goals, settings, plus, search, chevron, trash, user).
- **Styling:** extend the existing CSS variables in `index.css`. Keep the dark theme. ClickUp uses a very dark sidebar (#1a1a1a-ish) with a slightly lighter content area. Use the existing `--bg`, `--bg-card`, `--border`, `--primary` (#6366f1 indigo) tokens.
- **Responsive:** on narrow screens (<768px), collapse the icon rail and/or project nav to icons-only or hide them (hamburger optional). Keep it functional on desktop first.
- **Do NOT change backend, API, or data model.** Pure frontend layout change.
- **Do NOT push to GitHub.** Work only in `/home/ubuntu/projects/glance`.
- Verify it builds: `cd frontend && npm run build`. Fix any errors.

## Deliverables
- Updated Layout.jsx + Layout.css implementing the 3-column ClickUp-style shell.
- Any supporting changes (UIContext for the "+ New" modal, view toggle wiring, icon components).
- `npm run build` passes.
- Report what you changed and any issues.
