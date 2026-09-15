# SPEC — Due-Date Countdown Chip on Kanban Cards & List Rows

## Objective
Show a tiny due-countdown chip on **Kanban cards** and **List rows** so users can see at a glance how a task's due date relates to today — e.g. `3d left`, `due today`, or `2d overdue`. Today the app only renders the raw due date and applies an `.overdue` class; there is no "days remaining / days overdue" signal.

## Assumptions / current state (verified)
- `frontend/src/components/overdue.js` exports `isOverdue(due_date, status, todayStr)` (no overdue-day count).
- Both `KanbanBoard.jsx` and `TaskList.jsx` already render a `.due-date` span with the raw `due_date`, and already style `.overdue` (red-ish) via their `.css`.
- Backend already returns `due_date` (ISO `YYYY-MM-DD`) on every task in `GET /project/:projectId`, `GET /mine`, and `GET /tasks/:id`. **No backend/schema change.**
- Frontend is React 18 + Vite, plain `.css`, neon cyberpunk theme (tokens `--danger`, `--warning`, `--success`, `--text-muted`).

## Scope — touch ONLY
- `frontend/src/components/overdue.js` (add helpers, keep `isOverdue` unchanged so existing imports work).
- `frontend/src/components/KanbanBoard.jsx` (render chip next to due date).
- `frontend/src/components/TaskList.jsx` (render chip next to due date).
- `frontend/src/components/KanbanBoard.css` + `frontend/src/components/TaskList.css` (add chip styling, reuse existing tokens).
Do NOT touch backend, db, other components, or view/filter logic.

## Implementation

### `overdue.js` — add exported helpers (keep `isOverdue` intact)
- `dueInfo(due_date, status, todayStr)` → returns `null` when `!due_date` or `status === 'done'` or the date is exactly today (today is neutral). Otherwise returns an object:
  ```js
  { days, overdue }   // days = |diff in whole days|; overdue = boolean (due_date < today)
  ```
  Compute whole-day diff: `Math.round((Date.parse(due) - Date.parse(today)) / 86400000)` (both are `YYYY-MM-DD` so local-DST-safe enough for this MVP).
- `label = overdue ? \`${days}d overdue\` : \`${days}d left\``. For `days === 0` return `{ days:0, overdue:false, label:'due today' }` (still a chip, but neutral).
- Keep `isOverdue` exactly as-is (other code depends on it).

### `KanbanBoard.jsx` + `TaskList.jsx`
- Compute `const info = dueInfo(task.due_date, task.status)` inline at render.
- Next to the existing `.due-date` span (when `task.due_date`), render a small chip:
  - `overdue` → class `due-chip due-chip-overdue` + label like `2d overdue`.
  - `days===0` → class `due-chip due-chip-today` + label `due today`.
  - else → class `due-chip` + label like `3d left`.
- Reuse the exact grid cell/row layout already present; do not change column counts or widths meaningfully (the chip is inline within the existing due cell / card meta row).

### CSS (both files)
- `.due-chip`: small inline-block pill, `font-size: 0.68rem`, padding `2px 6px`, border-radius `999px`, `margin-left: 4px`, color/background from tokens:
  - overdue: `color: var(--danger)`, background `rgba(255,77,109,0.12)`, border `1px solid rgba(255,77,109,0.35)`.
  - today: `color: var(--warning)`, background `rgba(255,176,32,0.12)`, border `1px solid rgba(255,176,32,0.35)`.
  - left: `color: var(--text-muted)`, background `var(--bg-hover)`, border `1px solid var(--border)`.
- Keep it subtle — a chip, not a big badge.

## Success criteria
1. A task due in the future shows `Nd left`; due today shows `due today`; overdue shows `Nd overdue`; `done` tasks or tasks with no `due_date` show **no** chip.
2. `isOverdue` behavior is unchanged (existing `overdue` row/card highlighting still works).
3. `cd frontend && npm run build` passes.
4. Rendered against the live-DB copy (real tasks with varied due dates) — chips show correctly, no errors, no layout breakage.
5. Done/no-due tasks unaffected.

## Constraints
- No schema/migration, no backend, no destructive commands, no secrets.
- Match existing neon theme + component style exactly. Minimal, readable diff.
