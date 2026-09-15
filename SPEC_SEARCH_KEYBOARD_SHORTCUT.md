# SPEC — Global Search Keyboard Shortcut (Cmd/Ctrl+K or "/") + Escape to close

## Objective
Let a logged-in user focus the top-bar **global search** instantly with a keyboard
shortcut (`Cmd/Ctrl+K`, or typing `/`) and close the search dropdown with `Escape`.
This is a small, self-contained UI increment consistent with the app's existing stack.
No backend change, no DB schema change.

## Assumptions / current state (verified)
- Layout top bar lives in `frontend/src/components/Layout.jsx` (imports already include
  `useState, useEffect, useRef` from 'react').
- The global search input is rendered in `Layout.jsx` at ~line 458:
  ```jsx
  <input
    type="text"
    className="search-input"
    placeholder="Search projects, tasks, comments..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    onFocus={() => { if (hasSearchResults) setSearchOpen(true); }}
    style={{ paddingLeft: '1.75rem' }}
  />
  ```
- There is a `searchRef` already declared (`const searchRef = useRef(null)` — verify) used
  on the wrapping `<div>` for click-outside-to-close. Reuse it or add a dedicated input ref.
- `searchOpen` state controls the dropdown; `setSearchOpen` toggles it.
- The component already has `useEffect` available. The top bar only renders for logged-in
  users (it's inside the protected Layout), so no auth gating is needed.

## Scope — touch ONLY
- `frontend/src/components/Layout.jsx` (and only if needed, a tiny bit of `Layout.css`).

Do NOT touch any other file, backend, or the database.

## Behavior
1. **Focus shortcut:** when the user presses `Cmd/Ctrl+K` or `/` anywhere in the app
   (except when already typing in an input/textarea/select or contenteditable — don't
   hijack normal typing), focus the search input and open the dropdown if there are
   results.
   - `Cmd/Ctrl+K`: always focus.
   - `/`: also focus, but ONLY when focus is NOT inside a text-entry element (so typing
     `/` in a comment/description still works normally).
2. **Escape:** when the search dropdown is open and the user presses `Escape` (while the
   input is focused, or via the same global listener when the dropdown is open), close
   the dropdown. Do NOT blur the input on a first Escape press if that feels jarring —
   preferred: one Escape closes the dropdown; a second Escape (input still focused,
   dropdown already closed) optionally blurs/clears. Keep it simple: Escape closes the
   dropdown if open; if dropdown is not open, Escape clears the query (or does nothing —
   pick the simpler: just close dropdown if open, else clear query & blur).
3. Add the shortcut hint as a small muted `kbd`-style chip inside the search box's
   right side (e.g. `⌘K` / `Ctrl K`) using the existing theme tokens
   (`var(--text-muted)`, `var(--border)`). Keep it subtle. Only when the input is empty.
4. Do NOT change the existing click-outside-to-close or the dropdown rendering.

## Success criteria (verifiable)
1. `cd frontend && npm run build` passes clean.
2. Pressing `Cmd+K` / `Ctrl+K` (with focus in the document body) focuses the search input.
3. Pressing `/` with focus NOT in an input/textarea (e.g. on the project list) focuses search.
4. Pressing `/` while typing inside a comment textarea does NOT trigger search focus.
5. With the search dropdown open, pressing `Escape` closes it.
6. Existing search typing, result selection, and Enter navigation still work.
7. No console errors; existing layout/styles preserved.

## Constraints
- Do NOT touch the backend or the database. No destructive operations.
- Match the existing React/JSX style (function component, `useState`/`useRef`/`useEffect`,
  `apiFetch` via context, plain `.css`). Follow the app's Neon theme tokens.
- Keep changes minimal and confined to `Layout.jsx` (+ optional `Layout.css`).
- Implement via the coding agent (`~/.opencode/bin/opencode`) — do not hand-edit source files.
