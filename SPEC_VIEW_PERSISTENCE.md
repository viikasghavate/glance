# SPEC — Persist Board/List/Timeline View Selection

## Objective
Remember the user's chosen **Board / List / Timeline** project view across page reloads and
session restarts by persisting it to `localStorage`. Today the view resets to "Board" on
every reload, so a user working in List/Timeline gets thrown back to Board each time they
refresh or revisit a project — a small but real UX friction. Frontend-only. No backend, no
DB schema/migration, no new dependencies.

## Assumptions / current state (verified in repo, main branch)
- The global view state lives in `frontend/src/context/UIContext.jsx`:
  `const [view, setView] = useState('board');` and is exposed via `value={{ ..., view, setView, ... }}`.
- The toggle lives in `frontend/src/components/Layout.jsx` (~lines 556-558): three buttons
  calling `setView('board' | 'list' | 'timeline')`, active state from `view === 'board'`, etc.
- `ProjectDetailPage.jsx` (lines 191/201/211) renders `{view === 'board' && <KanbanBoard/>}`,
  `{view === 'list' && <TaskList/>}`, `{view === 'timeline' && <TimelineView/>}`.
- The app already uses `localStorage` elsewhere (AuthContext token, SettingsPage theme via
  `glance_theme`, UIContext is inside the auth-protected tree). Follow that convention.
- Valid view values: `'board'`, `'list'`, `'timeline'`.

## Scope — touch ONLY
- `frontend/src/context/UIContext.jsx`

Do NOT touch Layout.jsx, ProjectDetailPage.jsx, any component, backend, db.js, package.json.
No drive-by refactors. The existing `view`/`setView` contract in the context value is unchanged
(consumers keep working); we only change how the initial value is seeded and how it is written.

## Behavior
1. On provider mount, initialize `view` from `localStorage.getItem('glance_view')` if it is one
   of `'board' | 'list' | 'timeline'`, else default to `'board'`. Use a lazy initializer
   (`useState(() => { ... })`) so it reads storage only once at mount, not every render.
2. Whenever `view` changes, persist it: `localStorage.setItem('glance_view', view)` in a
   `useEffect([view])`. (Note: useEffect already imported in the file.)
3. Guard against malformed/corrupt stored values: if the stored string is not exactly one of the
   three valid values, ignore it and fall back to `'board'` (do not crash, do not throw).
4. This is a **global** preference (one stored value for the app, not per-project), matching
   how `view` is currently a single global useState. Changing view on one project affects all —
   that is the existing behavior; persistence just makes it survive reloads. Do not introduce
   per-project keys.

## Success criteria
1. `cd /home/ubuntu/projects/glance/frontend && npm run build` exits 0 with no errors.
2. Pick "List" (or "Timeline") on a project, then hard-reload the page: the app comes back on
   List/Timeline (not Board). "Board" also persists.
3. An invalid stored value (e.g. manually set `glance_view=hack`) still falls back to Board with
   no console error.
4. No regression: existing Board/List/Timeline switching, routing, and all project/task
   functionality work.

## Constraints
- Do NOT edit backend files, db.js, or run destructive/DB-writing commands.
- Keep the change minimal and readable; follow existing React/JSX + localStorage conventions.
- Verify against a COPY of the live DB (real projects/tasks) — no errors on real data.
- After building, report the exact change.
