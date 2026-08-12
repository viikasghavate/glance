# Glance — Fix Gradient Seams Between Columns

The dark-indigo → dark gradient on `.app-shell` is set correctly, and the column backgrounds are transparent, BUT visual seams remain between the three columns (icon rail / project nav / main content). The background does not read as one continuous gradient. Fix this so the gradient flows seamlessly left-to-right with no visible color jumps.

## Current state (frontend/src/components/Layout.css)
- `.app-shell` has `background: linear-gradient(90deg, #241a45 0%, #181b2a 45%, #0f1117 100%)`.
- `.icon-rail` and `.project-nav` have `background: transparent` but each has `border-right: 1px solid var(--border)`.
- `.top-bar` has `background: rgba(26,29,39,0.6)` + backdrop blur.
- `.content-area` has no background (transparent).

## Problems to fix
1. **Border seams**: the `border-right: 1px solid var(--border)` on `.icon-rail` and `.project-nav` create crisp vertical lines that visually split the gradient. Remove these borders (or replace with a very subtle, semi-transparent divider that doesn't read as a seam, e.g. `rgba(255,255,255,0.04)` or none at all).
2. **Gradient too subtle/broken-feeling**: the current gradient fades to near-black by ~45%, so the left columns look "indigo" but the main content looks flat dark. Make the gradient flow more smoothly and continuously across the full width so it reads as one coherent left-to-right fade. Tune the stops, e.g.:
   - `linear-gradient(90deg, #2a1e52 0%, #1e2035 40%, #16181f 70%, #0f1117 100%)` (adjust as needed).
   - Keep it tasteful: indigo/violet visible at the far left, smoothly darkening to near-black at the right.
3. **Top bar**: ensure the translucent top-bar (`rgba(26,29,39,0.6)` + blur) doesn't create a hard horizontal band that breaks the vertical gradient perception. It's fine as-is if it looks subtle; if it reads as a distinct dark bar, lighten it (e.g. `rgba(20,22,28,0.4)`) so the gradient shows through more.
4. **Ensure body/wrappers don't cover the gradient**: confirm no parent (body, #root, main-area, content-area) has an opaque background that hides `.app-shell`'s gradient. `.main-area` and `.content-area` should remain transparent. If any opaque `var(--bg)` is applied to content containers, remove it so the gradient shows through the content backdrop (keep cards/inputs/modals opaque for readability).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- CSS-only changes to `frontend/src/components/Layout.css` (and `index.css` only if needed to remove an opaque body/wrapper bg).
- Preserve all functionality and readability.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what CSS you changed.

## Deliverables
- Seamless, continuous left-to-right dark-indigo → dark gradient across all three columns with no visible column seams.
- Build passes.
