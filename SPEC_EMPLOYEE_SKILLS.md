# Glance — Employee Skill Management Blueprint

Status: Proposal (review before delegating to OpenCode)
Target app: Glance (glance.ghavate.com, repo `/home/ubuntu/projects/glance`)
Stack: **better-sqlite3** backend (ESM) + **React/Vite** frontend, single Docker container.
Follows existing conventions in `backend/db.js`, `backend/routes/*.js`, `frontend/src/pages/*`, `frontend/src/components/*`.

---

## 1. What we're building

A **Skills module** so employees can maintain their own skill profiles and managers/admins can see coverage:

- **Skills catalog** — a controlled list of skills (e.g. "React", "SQL", "Terraform"), optionally grouped by category.
- **Employee skills** — each user links themselves to skills with a **proficiency level** (Beginner / Intermediate / Advanced / Expert) and optional **years of experience**.
- **Skill coverage view** — an admin/member-facing page to see who has which skill and at what level (helps staffing / gap analysis).
- **Skill search/filter** — find people by skill + proficiency.

Out of scope (phase 2, noted at the end): skill endorsements/verification, per-project skill requirements, certifications with expiry, skill-based task assignment suggestions.

---

## 2. Data model — `backend/db.js`

### 2.1 New tables (added to the `db.exec` CREATE block + migrations)

Follow the SAME pattern as `portfolios`/`programs` (tables created idempotently, then migrations add columns for upgrades). Because these are **brand-new tables**, the cleanest path is:

1. Add the two `CREATE TABLE IF NOT EXISTS` statements to the `db.exec(...)` block (safe — new tables don't affect existing DBs).
2. **No recreate needed** since these are new tables, not column additions to existing ones. (Contrast: `projects`/`tasks` needed `recreateTablesTable()` because they pre-dated the migration system.)

```sql
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  level TEXT NOT NULL DEFAULT 'Intermediate'
    CHECK(level IN ('Beginner','Intermediate','Advanced','Expert')),
  years_experience REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, skill_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

**Design notes:**

- `UNIQUE(user_id, skill_id)` — a user can only have ONE row per skill. This forces the "set level" (upsert) rather than duplicate rows. It also gives you the FK-cascade delete for free when a user or skill is removed.
- `level` uses a `CHECK` constraint mirroring the existing `tasks.status`/`projects.status` CHECK pattern in this codebase.
- **Self-management**: we deliberately do NOT put skills on the `users` table as comma-delimited text. The relational `user_skills` M2M is the correct fit and matches how `task_labels`/`project_tags` are handled elsewhere.
- Deletion behavior: deleting a user already cascades (users routes delete the user row; `user_skills` FK cascade cleans up). Deleting a skill cascades its `user_skills`.

### 2.2 Indexes (add to the index block in `db.exec`)

```sql
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON user_skills(skill_id);
```

### 2.3 Migrations

**Not strictly required** if you add the tables to the `db.exec` block directly (new installs + existing DBs both get them on next boot). To be explicit and consistent with how the repo tracks schema evolution, optionally add a no-op marker migration:

```js
{
  name: 'skills_tables',
  up: () => { /* tables created in db.exec block */ }
},
{
  name: 'user_skills_level_years',
  up: () => {
    // no-op placeholder for future column additions
  }
}
```

**⚠️ Gotcha (the one to remember):** any future `CREATE INDEX` on a column added by a later migration MUST go inside that migration's `up()`, NOT in the `db.exec` index block — CREATE INDEX on a not-yet-existing column fails on existing DBs and rolls back the deploy. See MEMORY.md "Migration index bug class". For these fresh tables, indexes in the `db.exec` block are fine because the tables + columns are created together.

---

## 3. Backend API — new file `backend/routes/skills.js`

Mount in `server.js`:

```js
import skillRoutes from './routes/skills.js';
...
app.use('/api/skills', skillRoutes);
```

Route file skeleton (mirror `portfolios.js` style — `requireAuth` on the router, `requireRole('admin')` on writes to the catalog):

```
GET    /api/skills                           → list skill catalog + per-skill user counts
POST   /api/skills              (admin)      → create skill
PATCH  /api/skills/:id          (admin)      → rename/re-categorize
DELETE /api/skills/:id          (admin)      → delete skill (cascades user_skills)

GET    /api/skills/user/:userId          → a user's own skill rows (level + years)
PUT    /api/skills/user/:userId          → upsert one of the user's skills (set level/years)
DELETE /api/skills/user/:userId/:skillId → remove a skill from a user

GET    /api/skills/coverage?skill=&level=&q=   → all user_skills joined with users+skills for the coverage matrix / search
```

**Ownership rules (important):**

- **Users edit their OWN skills** → `GET/PUT/DELETE /api/skills/user/:userId` allow when `req.user.id === userId`.
- **Admins edit anyone's** → the same endpoints pass for `role === 'admin'`. (A manager can maintain a profile for an employee.)
- **Catalog CRUD** (`POST/PATCH/DELETE /api/skills`) → `requireRole('admin')` only. Catalog shape is a controlled list, not free-form.
- **Coverage/read** → `requireAuth` only, so members can browse who has what.

**Response shape** — keep consistent with `users.js` stats style (nested object, camelCase):

```json
{
  "id": 3,
  "name": "React",
  "category": "Frontend",
  "description": "",
  "userCount": 4
}
```

For coverage rows:

```json
{
  "userId": 5,
  "userName": "Ada Lovelace",
  "skillId": 3,
  "skillName": "React",
  "level": "Advanced",
  "yearsExperience": 6
}
```

**Activity logging** — add `logActivity(...)` calls on create/delete/update of skills and on profile changes, matching the `user.role_changed` / `user.created` pattern in `users.js`. Actions: `skill.created`, `skill.updated`, `skill.deleted`, `user.skill_set`, `user.skill_removed`.

---

## 4. Frontend

### 4.1 New page — `frontend/src/pages/SkillsPage.jsx` (+ `.css`)

Model it on `UserManagementPage.jsx` (admin list page) + `SettingsPage.jsx` (self-editing profile) combined, since this module has **two audiences**:

- **Tabs on the page:**
  - **My Skills** (default, all roles): current user edits their own proficiency table — rows of (skill, level dropdown, years input, remove), plus an "Add skill" combobox filtered from the catalog.
  - **Team Coverage** (member+, shows useful to all): filterable matrix — rows = people, columns = skills, cell = level badge; filter by skill name + min level. Uses `GET /api/skills/coverage`.
  - **Catalog** (admin only): CRUD the skill master list (add/rename/categorize/delete). Admin-only tab.

### 4.2 Routing — `frontend/src/App.jsx`

```jsx
import SkillsPage from './pages/SkillsPage';
...
<Route path="skills" element={<SkillsPage />} />
```

### 4.3 Nav — `frontend/src/components/Layout.jsx`

Add an icon-rail entry, following the existing `IconUsers` (admin-only) pattern. Decide visibility: skills are useful for all members, so make it visible to all logged-in users (NOT admin-gated), placed near Members:

```jsx
<Link to="/users" ...>   {/* existing */}
<Link to="/skills" className={`icon-rail-btn ${location.pathname === '/skills' ? 'active' : ''}`} title="Skills">
  <IconSkills />   {/* add IconSkills to the icon set in Layout.jsx */}
</Link>
```

Add the `IconSkills` component (e.g. a badge/award glyph) to the icons defined in `Layout.jsx`, matching the existing `IconUsers`/`IconPortfolios` style.

### 4.4 UI conventions to follow

- **Pitch-black neon theme** is a runtime HTML-output convention for generated files — do NOT apply it here; the app has its own established dark theme in `index.css` / `Layout.css`. Match the existing Glance styling exactly.
- Level badges: reuse the severity-chip/colored-chip look from `TaskDetailModal` (Beginner=gray, Intermediate=cyan, Advanced=magenta/purple, Expert=gold) — consistent with the app's existing colored status labels.
- Use the existing modal pattern (`ProjectModal`/`MemberModal`) for the "add skill" dialog and catalog editor.

---

## 5. Seed data — optional

Optionally extend `backend/seed-demo.js` (idempotent, safe to re-run) with:
- ~10 catalog skills grouped by category (Frontend/Backend/DevOps/Data/AI).
- Realistic `user_skills` rows for the 3 demo users (demo.dev/pm/design@glance.local) at varied levels.

Keep it separate in the seed file and idempotent (`INSERT OR IGNORE` on the `UNIQUE` key) so re-running doesn't duplicate.

---

## 6. Deployment & verification

Deploy cycle (from MEMORY.md, unchanged):
1. Edit `backend/db.js`, `backend/routes/skills.js`, `server.js`, `frontend/src/*`.
2. `cd /home/ubuntu/projects/glance && git add -A && git commit`.
3. Push; trigger Coolify deploy: `POST /api/v1/deploy` with `{uuid: "r2xw1rgnwjaq4kq6c4rsayr7"}` using `TOKEN="$(cat .coolify-token)"`.
4. Health check `glance.ghavate.com/health`.

**⚠️ Live-DB test before deploy** (the "test against LIVE DB, not a fresh one" lesson from 2026-08-25): docker exec into the running container or copy `glance.db` + `-wal` + `-shm` and run `node backend/db.js` against that copy to confirm:
- New tables create cleanly on the live schema (no migration failures).
- Existing `projects`/`tasks` data untouched (no recreate triggered).
- `users` delete still cascades (delete a throwaway user → their `user_skills` gone).

**Manual verification checklist:**
- [ ] Catalog: admin creates/renames/deletes a skill; non-admin gets 403.
- [ ] My Skills: user sets their own level/years; upsert doesn't duplicate the row.
- [ ] Ownership: user cannot PUT another user's skills; admin can.
- [ ] Coverage: matrix + filter by skill/level returns correct people.
- [ ] Cascade: deleting a user removes their `user_skills`; deleting a skill removes it from everyone.

---

## 7. Phase 2 (future, separate specs)

- Skill endorsements / verification (someone confirms competence) — new `skill_endorsements` table.
- Per-project required skills + gap report ("Project X needs 2 React Advanced, we have 1").
- Skill certification tracking with expiry + expiry notifications.
- Skill-driven task assignment suggestions (link to existing `tasks` assignee flow).

---

## 8. Pre-deploy sanity (from prior lessons — do NOT skip)

1. **Migration index ordering** — the CREATE INDEX for any column a migration adds later must live in that migration's `up()`. Our new-table indexes are safe in the `db.exec` block, but keep this rule for any future column add.
2. **Test against a LIVE-DB copy** (with `-wal`/`-shm`), not a fresh DB.
3. **RBAC** — respect the `role` field ('admin' | 'member' | 'viewer'): viewer should see coverage read-only, not edit. Gate catalog edits to admin.
