# Glance — Continuous Left-to-Right Gradient Background

Add a tasteful **dark-indigo → dark** gradient background that spans **continuously across all three columns** of the app shell (icon rail → project nav → main content), perfectly aligned left-to-right. Currently each column has a solid background (`#14151a`, `#1a1b21`, `var(--bg)`) that breaks any continuous gradient.

## Current structure (frontend/src/components/Layout.css)
- `.app-shell` is a CSS grid: `grid-template-columns: 56px 240px 1fr`, height 100vh.
- `.icon-rail` has `background: #14151a` (solid).
- `.project-nav` has `background: #1a1b21` (solid).
- `.main-area` / `.content-area` use `var(--bg)` (#0f1117) from body.

## Goal
A single continuous gradient applied to the whole `.app-shell` (or a shared parent) that:
- Starts **dark-indigo** at the far left (icon rail edge).
- Fades through a dark tone across the middle (project nav).
- Ends **dark** at the right (main content).
- Is PERFECTLY ALIGNED — no visible seams or color jumps between the three columns.

## Implementation approach (recommended)
1. Apply the gradient to a single element that covers the full shell width:
   - Option A: set the gradient on `.app-shell` itself (e.g. `background: linear-gradient(to right, #1a1035 0%, #14151a 30%, #0f1117 100%)` or similar dark-indigo → dark), AND make `.icon-rail`, `.project-nav`, `.main-area`, `.content-area` backgrounds **transparent** (or semi-transparent) so the gradient shows through uniformly.
   - Option B: wrap the columns in a shared background layer.
   Prefer Option A — simplest, keeps the grid layout intact.

2. **Keep text readable**: text colors (`--text`, `--text-muted`) and component backgrounds (cards, inputs, dropdowns, modals) should stay mostly as-is (opaque `--bg-card`/`--bg-input`) so UI elements remain legible on top of the gradient. Only the shell backgrounds (icon rail, project nav, main content backdrop) become transparent/translucent to reveal the gradient.

3. **Suggested gradient** (tasteful dark-indigo → dark):
   `linear-gradient(90deg, #241a45 0%, #181b2a 45%, #0f1117 100%)`
   Tune as needed — should look subtle and cohesive, not garish. The indigo should be most visible at the far-left icon rail and fade toward dark on the right.

4. **Top bar**: `.top-bar` currently has `background: var(--bg-card)` (opaque). Consider making it transparent or translucent (e.g. `rgba(26,29,39,0.6)` + backdrop-filter blur) so the gradient continues through it, OR keep it opaque for a clean contrast. Your choice — prefer a subtle translucent top bar so the gradient flows.

5. **Responsive**: keep the same behavior on mobile (columns collapse). The gradient should still span whatever columns are visible.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- Do NOT change backend, data model, or component structure/JSX — only CSS (and tiny CSS-only tweaks).
- Preserve all functionality.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what CSS you changed.

## Deliverables
- Updated `frontend/src/components/Layout.css` (and `index.css` if needed) implementing the continuous left-to-right dark-indigo → dark gradient aligned across all columns.
- Build passes.
