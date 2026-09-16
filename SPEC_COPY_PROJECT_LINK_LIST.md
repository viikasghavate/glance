# SPEC — Copy Project Link on Project List page

## Goal
Add a small **Copy Link** button to each project card on the Project List page
(`frontend/src/pages/ProjectListPage.jsx`) so a user can quickly copy a shareable
deep-link to any project without opening it first. This mirrors the already-shipped
"Copy Project Link" button on the Project Detail header (`SPEC_COPY_PROJECT_LINK`) and
the "Copy Task Link" button in the Task Detail modal — same clipboard convention, same
feedback pattern. **Frontend-only.** No backend change, no DB schema/migration, no new
dependencies.

## Assumptions (verified in repo, main branch)
- Each project card on the Project List page is a `<Link to={`/project/${p.id}`}>` row
  (inside a `.project-card` / project-list grid). Project rows carry `p.id`.
- The app's existing clipboard convention (used by Copy Project Link in
  `ProjectDetailPage.jsx` and Copy Task Link in `TaskDetailModal.jsx`):
  - `const url = window.location.origin + '/project/' + id;`
  - try `navigator.clipboard.writeText(url)`; on failure or missing API, fall back to a
    temp-textarea `document.execCommand('copy')`.
  - show transient "Copied!" feedback (~1.5s) by flipping button label/state, then revert.
- `ProjectListPage.jsx` is a function component using `useAuth`, `useUI`, `useNavigate`,
  `Link`, plain `.css` (`ProjectListPage.css`). It renders cards in a loop.

## Scope — touch ONLY
- `frontend/src/pages/ProjectListPage.jsx`
- `frontend/src/pages/ProjectListPage.css` (only if a small new class is needed for the
  copy button / "Copied!" state)

Do NOT touch backend, db.js, other components/pages, package.json. No drive-by refactors.
Keep the existing card `<Link>` intact (clicking the card still navigates; the copy button
is a separate small control, e.g. a `btn-ghost btn-sm` in the card footer/header, and
must not intercept the card's navigation link).

## Behavior
1. Each project card gets a small **Copy Link** button (use `btn-ghost btn-sm` or a muted
   icon-style button consistent with the Neon theme).
2. On click (stop propagation so it doesn't navigate):
   - build `const url = window.location.origin + '/project/' + p.id;`
   - copy to clipboard (clipboard API with execCommand fallback, per the existing pattern).
   - flip the button to "Copied!" for ~1.5s, then revert (use a per-card state; if you use
     a single state for all cards, key it by the clicked project id).
3. Handle failure gracefully (fallback already covers execCommand; if copy throws, still
   show "Copied!" per the existing pattern — keep it simple and consistent).

## Success criteria
1. Every project card on the Project List page shows a Copy Link button.
2. Clicking copies `https://<host>/project/<id>` to the clipboard and shows "Copied!".
3. Clicking the button does NOT navigate to the project (event stopped).
4. Clicking anywhere else on the card still navigates as before.
5. `cd frontend && npm run build` passes with no errors.

## Constraints
- Frontend only. Do not edit `backend/`. Do not run destructive commands. No new deps.
- Preserve the Neon Cyberpunk theme and existing card layout.
- Keep the change minimal and consistent with the existing Copy Link pattern in the repo.

## Deliverables
- Copy Link button on each project card + clipboard + "Copied!" feedback.
- `npm run build` passes.
- Report exactly what changed and the build result. (The coordinator handles commit + deploy.)
