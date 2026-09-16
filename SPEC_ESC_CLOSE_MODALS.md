# SPEC — Press Escape to Close Any Modal

## Objective
Allow the user to close **any open modal** by pressing the `Escape` key, matching
standard web-app UX. Today NOTHING in Glance closes on Escape — only the top-bar
search dropdown responds to Escape (`Layout.jsx`). Every modal must be dismissed
only by clicking the overlay, an X button, Cancel, or a task action. This is a
**frontend-only** increment. No backend, no DB schema, no migration, no new deps.

## Background (verified in repo, main branch)
- Modal overlays all use the same pattern: `<div className="modal-overlay" onClick={onClose}>`
  wrapping `<div className="modal" onClick={e => e.stopPropagation()}>`. The overlay
  click handler (or an equivalent close setter) is the single "close" entry point.
- `Layout.jsx` already registers a global `keydown` listener and closes the search
  dropdown on `Escape` (lines ~339-344). It must be left untouched by this spec
  (it manages its own surfaces). We add per-modal Escape handling instead.
- Modal components / inline overlays (all confirmed present; each has an `onClose` prop
  or a local close setter):
  1. `frontend/src/components/TaskDetailModal.jsx` — prop `onClose`
  2. `frontend/src/components/TaskModal.jsx` — prop `onClose`
  3. `frontend/src/components/ProjectModal.jsx` — prop `onClose`
  4. `frontend/src/components/MemberModal.jsx` — prop `onClose`
  5. `frontend/src/components/SprintSection.jsx` — inline overlay, close via `setShowModal(false)`
  6. `frontend/src/components/MilestoneSection.jsx` — inline overlay, close via `setShowModal(false)`
  7. `frontend/src/pages/UserManagementPage.jsx` — two inline overlays: confirm-delete
     (`setConfirmDelete(null)`) and reset-password (`setResetUser(null)`)
  8. `frontend/src/pages/SkillsPage.jsx` — `EndorseModal` (prop `onClose`) rendered at
     line ~287
  9. `frontend/src/pages/PortfolioPage.jsx` — two inline function components:
     `PortfolioModal` (prop `onClose`, overlay line 235) and `ProgramModal`
     (prop `onClose`, overlay line 297)

## Scope — touch ONLY these files
- `frontend/src/components/TaskDetailModal.jsx`
- `frontend/src/components/TaskModal.jsx`
- `frontend/src/components/ProjectModal.jsx`
- `frontend/src/components/MemberModal.jsx`
- `frontend/src/components/SprintSection.jsx`
- `frontend/src/components/MilestoneSection.jsx`
- `frontend/src/pages/UserManagementPage.jsx`
- `frontend/src/pages/SkillsPage.jsx`
- `frontend/src/pages/PortfolioPage.jsx`

Do NOT touch `Layout.jsx` (its Escape handling is out of scope), backend, `db.js`,
`server.js`, `package.json`, CSS files, or any other component. No drive-by refactors.

## Preferred implementation (small shared hook, then use it per modal)
Add a tiny hook `useCloseOnEsc(onClose)` — a new small module
`frontend/src/components/useCloseOnEsc.js` — that registers a `keydown` listener
(cleanup on unmount) and calls `onClose` when `e.key === 'Escape'`:

```js
import { useEffect } from 'react';

export default function useCloseOnEsc(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}
```

Then in each modal component call `useCloseOnEsc(onClose)` (or the local close
setter for the inline overlays):
- Components with an `onClose` prop: `useCloseOnEsc(onClose)`.
- `SprintSection.jsx` / `MilestoneSection.jsx` inline overlay: add `useCloseOnEsc(() => setShowModal(false))` — call the hook unconditionally at top level, NOT inside the conditional `{showModal && (...)}` render, so the listener lifecycle is tied to the component not the open state (safe either way since the handler is a no-op when closed; but keep hooks at top level per React rules). Prefer: only register while open via `useCloseOnEsc(showModal ? () => setShowModal(false) : null)` — the hook must guard `onClose?.()` when it's `null` (already handled).
- `UserManagementPage.jsx`: register Escape for the reset-password modal
  (`useCloseOnEsc(resetUser ? () => setResetUser(null) : null)`) and for the
  confirm-delete modal (`useCloseOnEsc(confirmDelete ? () => setConfirmDelete(null) : null)`).
  These use the component's state setters; keep the hooks at top level of the page
  component with the conditional-guard pattern above.
- `SkillsPage.jsx`: inside `EndorseModal`, `useCloseOnEsc(onClose)`.
- `PortfolioPage.jsx`: inside `PortfolioModal` and `ProgramModal`,
  `useCloseOnEsc(onClose)`.

If you prefer NOT to add a new hook file, inline the same tiny `useEffect` +
`keydown` listener directly in each modal (duplicated) — acceptable, either way.
Keep it minimal.

## Success criteria
1. `cd frontend && npm run build` passes with **no errors**.
2. With any of the following open, pressing `Escape` closes it: TaskDetailModal,
   TaskModal (new/edit task), ProjectModal (new/edit project), MemberModal
   (add/edit member), Sprint modal, Milestone modal, Reset-Password modal,
   Confirm-Delete modal, Endorse modal, Portfolio modal, Program modal.
3. Existing close paths still work (overlay click, X, Cancel) — no regression.
4. Escape while typing in a modal's text field also closes the modal (standard
   behavior; no special-casing text inputs required — keep it simple and consistent:
   Escape closes regardless of focus). Note: do NOT add global Escape handling in
   Layout that could conflict; per-modal listeners only.
5. No console errors; the search dropdown's existing Escape behavior (Layout.jsx)
   is unchanged.

## Constraints
- Frontend-only. One small new hook file (or inline duplication) + edits to the 9
  listed source files. No CSS, no backend, no package.json changes.
- Do not hand-edit source — implement via the coding agent, then run the build
  yourself and confirm.
- Keep prod healthy; if a deploy breaks, revert.
