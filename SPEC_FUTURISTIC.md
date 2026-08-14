# Glance — Apply Neon Cyberpunk Futuristic Theme

Apply the "Neon Cyberpunk" futuristic theme (Option A) to the entire app. The user approved the visual direction shown in the preview. This is a **CSS-only** change (plus adding Google Fonts) — no backend changes.

## Theme direction (from approved preview)
- **Base:** deep-space dark background (`#0a0e17`-ish) with a subtle animated grid + radial glow.
- **Accents:** cyan (`#00e5ff`) → violet (`#8b5cf6`) gradient for primary elements.
- **Neon glow:** box-shadows/text-shadows with cyan/violet glow on active/hover elements.
- **Glassmorphism:** translucent cards with backdrop blur.
- **Glowing status chips:** neon cyan/violet/green/amber/red pills.
- **Futuristic fonts:** Orbitron (headings) + Space Grotesk (body) via Google Fonts.

## Changes

### 1. `frontend/src/index.css` — update `:root` tokens
- `--bg`: `#0a0e17`
- `--bg-card`: `rgba(20, 26, 40, 0.6)` (translucent for glassmorphism)
- `--bg-card-solid`: `#141a28` (add this for solid surfaces like inputs)
- `--bg-hover`: `#1c2436`
- `--bg-input`: `#141a28`
- `--border`: `rgba(0, 229, 255, 0.18)`
- `--text`: `#e8f6ff`
- `--text-muted`: `#7d8ba3`
- `--primary`: `#00e5ff` (cyan) OR keep a cyan→violet gradient for primary buttons
- `--primary-hover`: `#00c4dd`
- `--violet`: `#8b5cf6` (add)
- `--cyan`: `#00e5ff` (add)
- `--success`: `#00ff9d`, `--warning`: `#ffb020`, `--danger`: `#ff4d6d`
- `--radius`: `12px`
- Add Google Fonts import: Orbitron + Space Grotesk. Set `body { font-family: 'Space Grotesk', ... }` and a `.font-display` / heading font-family for headings (Orbitron).

### 2. `frontend/src/index.css` — global futuristic touches
- Add an animated grid background to `body` (CSS background with linear-gradient grid lines + a radial glow overlay). Keep it subtle so content stays readable.
- Add glow to `.btn-primary` (gradient background + box-shadow glow).
- Add glow to `.badge-*` status/priority pills (neon colors + subtle box-shadow).
- Add glassmorphism to `.modal`, `.card`, `.user-dropdown` (translucent bg + backdrop-filter blur).
- Add glow to `.spinner` and focus states.

### 3. `frontend/src/components/Layout.css` — futuristic shell
- `.app-shell` background: keep `var(--bg)` (the grid/glow comes from body).
- `.icon-rail`: darker translucent bg, glowing active icon (cyan/violet gradient + box-shadow glow).
- `.project-nav`: translucent dark bg, glowing active project item.
- `.top-bar`: translucent with backdrop blur.
- `.user-avatar`: gradient (cyan→violet) with glow.
- `.view-toggle-top button.active`: gradient + glow.
- `.search-input`: dark translucent with cyan focus glow.

### 4. Other components (KanbanBoard, TaskList, TimelineView, ProjectListPage, modals)
- Apply the theme tokens consistently: glowing task cards, neon status/priority badges, gradient progress bars, glowing kanban column headers, futuristic timeline bars (cyan/violet/green/amber by status).
- Ensure text remains readable (light text on dark).
- Keep all functionality identical — only visual styling changes.

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- CSS-only + Google Fonts import. No JSX/backend changes unless strictly needed for a class.
- Preserve all functionality (RBAC, views, subtasks, etc.).
- After implementing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report what you changed.

## Deliverables
- Futuristic Neon Cyberpunk theme applied across the app (index.css + Layout.css + component CSS).
- Build passes.
