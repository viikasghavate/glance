# Glance — Match ClickUp's Dark Theme (remove gradient)

The current app has a dark-indigo gradient background which does NOT match ClickUp. ClickUp's Dark Mode is a clean, **monochrome dark theme**: near-black backgrounds, white/light text, subtle borders, with the accent color (indigo/purple) reserved for primary buttons, active states, and links. Remove the gradient and apply a faithful ClickUp-style dark palette.

## What to change

### 1. Remove the gradient (frontend/src/components/Layout.css)
- `.app-shell` currently has `background: linear-gradient(90deg, #2a1e52 0%, #1e2035 40%, #16181f 70%, #0f1117 100%)`. **Remove it** — set `.app-shell` background to a flat dark color (or leave transparent so body shows through). Do NOT use any gradient.
- `.icon-rail`, `.project-nav` should have their own flat dark backgrounds again (ClickUp uses slightly distinct shades for the icon rail vs the sidebar).
- Revert the border-right seams to normal subtle borders.

### 2. Apply ClickUp dark palette (frontend/src/index.css `:root` tokens)
ClickUp dark mode uses these approximate values (neutral, monochrome):
- `--bg`: **#1a1a1a** (main background) — ClickUp dark is near-black with slight gray
- `--bg-card`: **#232323** (cards/surfaces)
- `--bg-hover`: **#2d2d2d**
- `--bg-input`: **#262626**
- `--border`: **#3a3a3a** (subtle borders; ClickUp uses dark gray borders)
- `--text`: **#f2f2f2** (near-white)
- `--text-muted`: **#9b9b9b** (gray secondary text)
- `--primary`: keep **#7b6cf6** or ClickUp's purple/indigo (ClickUp uses a violet-purple accent ~#7B68EE / #8B5CF6). Set `--primary: #8b5cf6`, `--primary-hover: #7c4ddf`.
- Keep `--danger`, `--success`, `--warning` (status colors — ClickUp keeps status colors).
- Add a `--sidebar` / rail color if useful (ClickUp icon rail is near-black `#151515`).

### 3. Layout.css color updates
- `.icon-rail`: background **#151515** (near-black).
- `.project-nav`: background **#1f1f1f** (slightly lighter than rail).
- `.top-bar`: background **#1f1f1f** (or transparent with the content area bg) — match ClickUp's neutral top bar. Remove the translucent gradient-backdrop treatment; use a solid subtle dark.
- `.content-area` / `.main-area`: transparent (show `--bg`).
- Ensure borders are the subtle `--border` (#3a3a3a), not white-tinted rgba.

### 4. Keep readability & status colors
- Status badges, priority badges, and project color dots should stay vivid (ClickUp keeps status/priority colors in dark mode).
- The user avatar, active nav item, and primary buttons use `--primary` (violet).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- CSS-only changes (index.css + Layout.css). No JSX/structure changes unless necessary.
- Must look clean, professional, and match ClickUp's neutral dark aesthetic — NOT colorful/gradient.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what CSS you changed (list each token/element and its old→new value).

## Deliverables
- ClickUp-style neutral dark theme, no gradient.
- Build passes.
