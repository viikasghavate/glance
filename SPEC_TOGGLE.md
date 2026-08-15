# Glance — Make Board/List/Timeline view toggle more spacious

The view toggle (Board | List | Timeline) in the top bar is too cramped. Make it more spacious and comfortable.

## Change (frontend/src/components/Layout.css)
Update `.view-toggle-top` and `.view-toggle-top button`:
- Increase button padding (e.g. `0.25rem 0.625rem` → `0.5rem 1.25rem` or similar — noticeably more spacious).
- Increase font-size (e.g. `0.75rem` → `0.875rem`).
- Add a comfortable gap between buttons (or keep the segmented look but with more breathing room).
- Ensure the active button (cyan→violet gradient + glow) still looks good with the larger size.
- Keep the segmented control look (rounded container, buttons inside).

## Constraints
- Do NOT push to GitHub. Work only in `/home/ubuntu/projects/glance`.
- CSS-only change to `frontend/src/components/Layout.css`.
- Preserve the futuristic theme and functionality.
- After editing, run `cd /home/ubuntu/projects/glance/frontend && npm run build` and fix any errors.
- Report exactly what you changed.

## Deliverables
- More spacious Board/List/Timeline toggle.
- Build passes.
