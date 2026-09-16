# SPEC — Copy Project Link (Project Detail page)

## Goal
Add a **Copy Project Link** button to the Project Detail page header so a user can copy a shareable link to any project. The app already has a proven "Copy Task Link" pattern in `TaskDetailModal.jsx` (clipboard API + temp-textarea fallback + transient "Copied!" feedback) — this spec surfaces the same affordance for the project itself, which currently has no way to share/open a direct project URL.

## Assumptions / current state (verified in repo, main branch)
- `frontend/src/pages/ProjectDetailPage.jsx` header (`.page-header` → `.view-actions` row) already renders action buttons: `Export CSV`, `Show/Hide archived`, and (for non-viewers) `+ New Task`. Add the new button to this `.view-actions` row, available to ALL roles (read-only copy).
- Deep-link scheme: a project page lives at `/project/:id`. Tasks deep-link within it via `/project/:id?task=:taskId` (used by Copy Task Link). A plain project link is `window.location.origin + '/project/' + project.id`.
- The page already imports `useAuth` (`useAuth()` → `{ apiFetch, hasRole }`). `project.id` is available from the route data (`project` object in state).
- Existing Copy Task Link implementation (mirror its handling — do NOT reinvent): `frontend/src/components/TaskDetailModal.jsx` `handleCopyLink` builds `const url = window.location.origin + '/project/' + task.project_id + '?task=' + task.id;`, tries `navigator.clipboard.writeText(url)`, falls back to a temp-textarea `document.execCommand('copy')`, sets `setCopied(true)` for ~1.5s, then reverts. Button class `btn-ghost btn-sm` with label flipping `Copy Link` ↔ `Copied!`.
- Styling: `.view-actions` buttons use existing `btn-ghost` / `btn-ghost btn-sm` classes (see ProjectDetailPage.css). No new theme.

## Scope — touch ONLY
- `frontend/src/pages/ProjectDetailPage.jsx` — add `copied` state + `handleCopyLink()` + a **Copy Link** button in `.view-actions`.
- `frontend/src/pages/ProjectDetailPage.css` — ONLY if a spacing tweak is genuinely needed (prefer reusing `btn-ghost btn-sm`; likely no CSS change at all).

Do NOT touch backend, db, server.js, other components/pages, package.json. No new dependencies. No drive-by refactors.

## Behavior
1. Add `const [copied, setCopied] = useState(false);` (near the other state in the component; `useState` is already imported).
2. `handleCopyLink`:
   - `const url = window.location.origin + '/project/' + project.id;`
   - Try `navigator.clipboard` API; fallback to a temp textarea + `document.execCommand('copy')` (copy the TaskDetailModal pattern exactly — clipboard may be unavailable on http/insecure contexts).
   - On success (and also after a successful fallback), `setCopied(true)`, `setTimeout(() => setCopied(false), 1500)`.
   - Wrap in try/catch; on hard failure just `console.error` (keep it simple, matching the task pattern — no error UI required).
3. Render button in `.view-actions` (place it before the `Export CSV` button):
   ```jsx
   <button className="btn-ghost btn-sm" onClick={handleCopyLink} title="Copy project link">
     {copied ? 'Copied!' : 'Copy Link'}
   </button>
   ```
   NOT gated by `!hasRole('viewer')` — copy is read-only, so viewers get it too (same as Copy Task Link being outside the `readOnly` guard).

## Success criteria
- Build passes: `cd frontend && npm run build` exits 0.
- A **Copy Link** button appears in the Project Detail header for ALL roles (including viewer).
- Clicking copies `https://<host>/project/<project_id>` to the clipboard; button shows "Copied!" transiently then reverts to "Copy Link".
- Pasting/opening that URL loads the project page (existing behavior; just the copied string is now correct).
- Existing header buttons (Export CSV / Show archived / New Task), task deep-links (`?task=`), and all other page functionality are unchanged (no regression).

## Constraints
- Frontend-only. Do NOT hand-edit source except through the coding-agent run.
- Keep prod (live Postgres, default engine) healthy — this change is UI-only, but still verify build + boot.
- No destructive/mass commands. No schema/migration change. No secrets.
