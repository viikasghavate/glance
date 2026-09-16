# SPEC — Personal Workspace Rail (extreme-left icon rail, no longer duplicates app nav)

## Objective
The user reports the two left panels are duplicating: the 56px **icon rail** (far left)
carries a **"New Project"** `+` button and a **mislabeled "New Task" `+` link that only
navigates to `/projects`** (it is NOT a task creator), while the 240px app navigator
already shows Projects/My Tasks/Dashboard/etc. and its own "New Project" entry. So the far
left rail adds nothing — it just repeats project-creation actions and a fake "New Task".

Fix: turn the extreme-left rail into a **personal workspace rail** holding only
user-personal controls that the app navigator does NOT show:
**Notifications (bell) · Theme toggle · AI Assistant launcher** (+ collapse). Remove the two
duplicate project-creation buttons. This gives the far-left panel a distinct, useful purpose.

Frontend-only. No backend change, no DB schema/migration, no new dependencies.

## Current state (verified in repo, main branch)
- `frontend/src/components/Layout.jsx`, the `{!railCollapsed && ( <nav className="icon-rail"> ... )}`
  block (~lines 379-404):
  1. Bell → `toggleNotifications` (keep)
  2. Theme moon/sun → `toggleTheme` (keep)
  3. `.icon-rail-spacer`
  4. `+` **New Project** → `openNewProjectModal` (REMOVE — duplicates nav "Add Project")
  5. `<Link to="/projects" title="New Task">` with `+` (REMOVE — mislabeled, just links to /projects)
  6. `.icon-rail-collapse` (keep)
- The app navigator (240px, same file) already lists "All Projects / My Tasks / Add Project /
  Dashboard / Activity / ... / New Project" — so creation is well covered there; the rail needn't
  repeat it.
- AI Assistant is a separate component `frontend/src/components/AIChatPanel.jsx` mounted once in
  this Layout (`<AIChatPanel />`, line ~623). It manages its OWN `open` state internally and
  renders a floating `.ai-launcher` button (bottom-right, sparkle icon). There is currently NO
  way to open it from the rail. It defines local icon components (sparkle etc.) not exported.
- `icon-rail`/`icon-rail-btn`/`icon-rail-btn.active`/`icon-rail-spacer`/`icon-rail-collapse` CSS
  classes exist in `frontend/src/components/Layout.css` (lines 13-64). `.icon-rail-btn.active`
  uses `linear-gradient(135deg, var(--cyan), var(--violet))` + `--glow-cyan` (nice for an "active"
  indicator).

## Scope — touch ONLY
1. `frontend/src/components/Layout.jsx`:
   - **Remove** the `openNewProjectModal` `+` button and the bogus `<Link to="/projects">New Task</Link>`
     from the rail.
   - **Add** an **AI Assistant** rail button that opens the existing AIChatPanel. To stay decoupled
     (AIChatPanel owns its `open` state), the rail button dispatches a window CustomEvent
     `window.dispatchEvent(new CustomEvent('glance:open-ai'))`; AIChatPanel listens and opens.
   - Add a small inline sparkle SVG icon component (reuse the visual language of the existing
     inline icon components in the same file). Give the button `title="AI Assistant"`.
   - Keep bell, theme toggle, spacer, collapse unchanged. Keep bell + theme as-is (personal controls).
2. `frontend/src/components/AIChatPanel.jsx`:
   - In the component, add a `useEffect` that subscribes to `window` `'glance:open-ai'` and calls
     `setOpen(true)` when fired. Keep the existing floating `.ai-launcher` button (both entry points
     open the same panel — no duplicate panel, no prop drilling). Clean up the listener on unmount.
     (Do NOT change the panel's open/close/send behavior otherwise.)
3. `frontend/src/components/Layout.css`:
   - No required changes. Optionally nothing. (The rail layout already fits.)

Do NOT touch backend, db.js, server.js, other pages/components, package.json. No new dependencies.
No drive-by refactors.

## Success criteria
1. The far-left rail now shows: bell · theme toggle · **AI Assistant** · collapse (spacer between
   theme and AI). No "New Project" `+` and no fake "New Task" link in the rail.
2. Project creation is still fully available via the app navigator ("Add Project" / "New Project")
   — no lost functionality.
3. Clicking the rail **AI Assistant** button opens the AI chat panel (the `.ai-panel.open` renders).
4. The AI panel still opens from its existing floating launcher; no double-panel, no errors.
5. `cd frontend && npm run build` passes with 0 errors.
6. App boots clean; `/health` healthy; no regressions to nav, theme toggle, or notifications.

## Constraints
- Do NOT edit backend files or `backend/db.js`. Do NOT run destructive or DB-writing commands.
- Follow existing React/JSX style (function components, inline SVG icon components, plain `.css`).
- Keep the change minimal, readable, and confined to the three files above.
- Do NOT remove the AI panel's own floating launcher (harmless redundancy; both open same panel).

## Verification
- `cd frontend && npm run build` exits 0.
- Backend boots clean against a COPY of the live DB (`/health` ok, no errors).
- Grep the built bundle for the new AI-rail button / sparkle icon and confirm no `title="New Task"`
  link to `/projects` remains in the rail markup.
