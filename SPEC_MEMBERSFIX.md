# Glance — Fix Broken Members Page Table

The Members page (`/users`, UserManagementPage.jsx) is visually broken because it reuses `className="task-table"` on a real `<table>` element, but `.task-table` CSS (in `frontend/src/components/TaskList.css`) was converted to a flex/grid-based layout for the TaskList:

```css
.task-table { display: flex; flex-direction: column; min-width: 1156px; }
```

When applied to the Members `<table>`, `display: flex; flex-direction: column` breaks the table structure (thead/tbody become flex columns), making it look broken. The TaskList's `.task-table-row`/`.task-table-cell` are divs; the Members page uses `<tr>`/`<td>`.

## Fix
Give the Members page its own clean table styling that doesn't conflict with the TaskList's grid `.task-table`:

1. In `frontend/src/pages/UserManagementPage.jsx`, change `className="task-table"` on the `<table>` to a new class, e.g. `className="members-table"` (and `task-table-wrap` → `members-table-wrap` if needed).
2. Create `frontend/src/pages/UserManagementPage.css` with proper table styles for the members table:
   - `display: table`, `width: 100%`, `border-collapse: collapse`, `font-size: 0.875rem`.
   - Style `th` and `td` with padding (e.g. `0.625rem 0.75rem`), left align, borders.
   - Header (`th`): Orbitron font, muted color, uppercase (match the futuristic theme).
   - `.date-cell`, `.status-select` should inherit existing styles (they're global).
   - `min-width` on the table (or wrap with overflow-x) so 9 columns fit — e.g. `min-width: 1000px` inside `.members-table-wrap { overflow-x: auto; }`.
3. Import the CSS in UserManagementPage.jsx (`import './UserManagementPage.css';`).
4. Keep the Neon Cyberpunk theme and all functionality (Add Member, search, role filter, edit, remove).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Do NOT modify TaskList.css (its `.task-table` grid is correct for the TaskList).
- Preserve functionality and theme.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed.

## Deliverables
- Members page table renders correctly (proper columns, aligned, not broken).
- Build passes.
