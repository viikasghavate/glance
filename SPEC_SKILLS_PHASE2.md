# Glance — Skills Phase 2: Per-Project Skill Requirements + Skill Endorsements

Status: Proposal (review before delegating to OpenCode)
Target app: Glance (glance.ghavate.com, repo `/home/ubuntu/projects/glance`)
Stack: **better-sqlite3** backend (ESM) + **React/Vite** frontend, single Docker container.
Builds on: **Skills Phase 1** (already shipped — catalog, `user_skills`, coverage). This spec extends it with two of the Phase-2 items called out at the end of `SPEC_EMPLOYEE_SKILLS.md`:
1. **Per-project required skills + gap report**
2. **Skill endorsements / verification**

NOT in this spec (future): certifications with expiry, skill-driven task assignment suggestions.

---

## 1. What we're building

**Feature 1 — Per-project skill requirements.** A project (or portfolio/program) states which skills it needs at minimum proficiency (e.g. "React Advanced ×2, SQL Intermediate ×1"). Managers see a **gap report**: required skills vs. who on the team actually has them, so they can spot understaffing.

**Feature 2 — Skill endorsements.** Anyone can endorse another user for a specific skill. Endorsements are a lightweight "I confirm this person is good at X" signal that bumps credibility. Each user's skill row shows an endorsement count; the coverage matrix can sort/filter by it. Distinct from the self-declared level — endorsed ≠ self-rated.

Both integrate with the **existing** `skills` / `user_skills` / `/api/skills/coverage` machinery and the existing **SkillsPage.jsx** tabs.

---

## 2. Data model — `backend/db.js`

### 2.1 New tables (add to the `db.exec` CREATE block + migration marker)

These are **brand-new tables** → add `CREATE TABLE IF NOT EXISTS` to the `db.exec(...)` block (safe on existing DBs), plus a no-op migration marker for schema-tracking consistency (same pattern as Phase 1's `skills_tables`).

```sql
-- A project REQUIRES a skill at a minimum level, with a desired headcount.
CREATE TABLE IF NOT EXISTS project_skill_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  min_level TEXT NOT NULL DEFAULT 'Intermediate'
    CHECK(min_level IN ('Beginner','Intermediate','Advanced','Expert')),
  min_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, skill_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- A user endorses another user for a skill (verification signal).
CREATE TABLE IF NOT EXISTS skill_endorsements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endorser_id INTEGER NOT NULL,     -- who gave the endorsement
  user_id INTEGER NOT NULL,         -- who received it
  skill_id INTEGER NOT NULL,
  note TEXT DEFAULT '',             -- optional short "why"
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(endorser_id, user_id, skill_id),
  FOREIGN KEY (endorser_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

**Design notes:**

- `project_skill_requirements.UNIQUE(project_id, skill_id)` — one requirement row per (project, skill); the "desired count" lives in `min_count`. This matches the `user_skills` upsert pattern.
- `project_id` FK → `projects` so deleting a project cascades its requirements.
- `min_level` CHECK mirrors `user_skills.level` exactly (same 4 levels) so gap math compares on the same scale.
- `skill_endorsements.UNIQUE(endorser_id, user_id, skill_id)` — a user can endorse a given (user, skill) only once. No self-endorsement (enforced in the route).
- Both cascade on user/skill/project delete — no orphan rows.

### 2.2 Indexes (add to the index block in `db.exec`)

```sql
CREATE INDEX IF NOT EXISTS idx_pkr_project ON project_skill_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_pkr_skill ON project_skill_requirements(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_user ON skill_endorsements(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_skill ON skill_endorsements(skill_id);
```

(All four are new-table indexes, safe in the `db.exec` block — the "migration index ordering" gotcha only applies to `CREATE INDEX` on a column added by a *later* migration.)

### 2.3 Migration marker

```js
{
  name: 'skills_phase2_tables',
  up: () => { /* tables created in db.exec block */ }
},
```

---

## 3. Backend — extend `backend/routes/skills.js`

Mount already exists (`app.use('/api/skills', skillRoutes)`). Add routes to the **existing** file. `requireAuth` is already on the router; catalog/requirement writes use `requireRole('admin')`; coverage/endorsements are auth'd.

### 3.1 Project skill requirements

```
GET    /api/skills/project/:projectId/requirements       → list required skills + fulfillment (gap info)
PUT    /api/skills/project/:projectId/requirements/:skillId  (admin) → upsert a requirement (min_level, min_count)
DELETE /api/skills/project/:projectId/requirements/:skillId  (admin) → remove a requirement
```

**`GET` response shape** — each row is a requirement **joined with live fulfillment** so the frontend can render the gap without a second call:

```json
[
  {
    "projectId": 3,
    "skillId": 2,
    "skillName": "React",
    "category": "Frontend",
    "minLevel": "Advanced",
    "minCount": 2,
    "coveredCount": 1,          // users with this skill AT OR ABOVE minLevel
    "coveredUsers": [ {"userId":5,"userName":"Ada Lovelace","level":"Advanced"} ],
    "gap": 1                    // max(0, minCount - coveredCount)
  }
]
```

Gap logic: `coveredCount` counts distinct `user_skills` rows where `level` index >= `min_level` index (use the same `LEVELS` order as `PUT /user/:userId`). `gap = max(0, minCount - coveredCount)`.

**`PUT` body:** `{ minLevel, minCount }`. Validate `minLevel` ∈ LEVELS, `minCount` ≥ 1 (integer). Upsert on `ON CONFLICT(project_id, skill_id) DO UPDATE`. Return the fresh requirement row.

**Activity logging** (match `user.skill_set` style): `project.skill_required`, `project.skill_requirement_updated`, `project.skill_requirement_removed`.

### 3.2 Skill endorsements

```
GET    /api/skills/endorsements?user=&skill=&endorser=       → list endorsement rows (joined names)
POST   /api/skills/endorsements                              → create an endorsement
DELETE /api/skills/endorsements/:id                          → remove an endorsement (own, or admin)
```

**`POST` body:** `{ userId, skillId, note? }`.

- **No self-endorsement:** `req.body.userId === req.user.id` → `400 { error: 'Cannot endorse yourself' }`.
- **Dup check:** `UNIQUE(endorser_id, user_id, skill_id)` → catch and return `409 { error: 'Already endorsed' }` (or `INSERT OR IGNORE` + check `changes`).
- Return `201` + the created row with `endorserName`/`userName`/`skillName` joined (useful for toast/refresh).

**`DELETE`:** owner (`endorser_id === req.user.id`) or `role === 'admin'` may remove. Else `403`.

**Read:** `GET /api/skills/endorsements` with optional `user`/`skill`/`endorser` filters (id or name — mirror the `coverage` route's id-or-name handling). Include a per-user **endorsement count** so the profile + matrix can show it.

### 3.3 Enrich existing endpoints (small additions)

- **`GET /api/skills/user/:userId`** — add `endorsements` (count array: `[{skillId, count}]`) per skill, computed from `skill_endorsements`. So the "My Skills" table can show "Ada endorsed by 3".
- **`GET /api/skills/coverage`** — add `endorsementCount` per coverage row (count of endorsements for that `(user_id, skill_id)`). Support `orderBy=endorsements` (high→low) as an optional query param; default stays name-ordered.

**Activity logging:** `user.skill_endorsed`, `user.skill_endorsement_removed`.

---

## 4. Frontend — extend `frontend/src/pages/SkillsPage.jsx` (+ `.css`)

Keep the existing **3 tabs** (My Skills / Team Coverage / Catalog). Add:

### 4.1 New tab 4 — "Project Gap" (member+, shows to all)

- A project selector (dropdown of projects the user can see — reuse the `/api/projects` list).
- On selection, `GET /api/skills/project/:projectId/requirements` renders:
  - Each required skill: name, category, `minLevel` chip, `minCount`, **covered count**, red/cyan **gap badge** when `gap > 0`, green chip when met.
  - Clicking a covered count expands the `coveredUsers` list (names + their levels).
- **Admin-only inline editor** in the same tab (or a settings subsection): "Add requirement" → pick skill + min level + min count; edit/remove an existing requirement row. Uses `PUT`/`DELETE` requirement endpoints.
- Follow `ProjectDetailPage` / `ProjectModal` modal patterns for the "add requirement" dialog.

### 4.2 Endorsements in existing tabs

- **My Skills tab:** each of the user's own skill rows shows an **endorsement count** badge (e.g. `🛡 3`) using the new `endorsements` field on `GET /user/:userId`. No click-through needed here (viewer is the subject, can't endorse self) — it's informational.
- **Team Coverage tab:** each coverage cell gets a small endorsement-count tag. Add a sort/filter control "Most endorsed" that calls `/coverage?orderBy=endorsements`.
- **New "Endorse" affordance** (any logged-in member): on the **Team Coverage** matrix, an `+ Endorse` action per (user, skill) cell opens a small modal (optional one-line note) → `POST /api/skills/endorsements`. Disable the cell if `userId === currentUser.id` (no self-endorse). After posting, refresh coverage.

### 4.3 Routing / nav

- No new route — everything lives under the existing `/skills` page (add the 4th tab). No `App.jsx`/`Layout.jsx` icon-rail change needed.

### 4.4 UI conventions

- **Do NOT apply the pitch-black neon HTML convention** — match the app's existing Glance dark theme (`index.css` / `Layout.css` / `SkillsPage.css`).
- Reuse the colored level chips already in SkillsPage (Beginner=gray, Intermediate=cyan, Advanced=magenta, Expert=gold). Reuse them for `min_level`.
- New **gap** chip: red when `gap > 0`, green "Met" when covered. Match existing severity-chip styling.
- Endorsement badge: small shield/count tag, muted until count > 0.

---

## 5. Seed data — extend `backend/seed-demo.js`

Keep idempotent (`INSERT OR IGNORE` on the unique keys). Add:

- **Project skill requirements** for 2-3 of the demo projects (ids 3-17): realistic rows, e.g. `(project_id=3, skill_id=React, min_level='Advanced', min_count=2)`, one that is **intentionally under-covered** so the gap report shows a red badge in demo.
- **Skill endorsements**: a handful across the 3 demo users (demo.dev/pm/design), e.g. dev endorses design for "UI/UX", pm endorses dev for "React", etc. No self-endorsements in seed.

---

## 6. Deployment & verification

Deploy cycle (from MEMORY.md, unchanged):
1. Edit `backend/db.js`, `backend/routes/skills.js`, `backend/seed-demo.js`, `frontend/src/pages/SkillsPage.jsx` (+ `.css`).
2. `cd /home/ubuntu/projects/glance && git add -A && git commit`.
3. Push; trigger Coolify deploy via `POST /api/v1/deploy` with `{uuid: "r2xw1rgnwjaq4kq6c4rsayr7"}` using `TOKEN="$(cat .coolify-token)"`.
4. Health check `glance.ghavate.com/health`.

**⚠️ Live-DB test before deploy** (the "test against LIVE DB, not a fresh one" lesson): docker exec into the container or copy `glance.db` + `-wal` + `-shm`, run `node backend/db.js` against that copy to confirm:
- The two new tables create cleanly on the live schema (no migration failures).
- Existing `skills` / `user_skills` / project data untouched (no recreate triggered).
- Project/skill/user delete still cascades (delete a throwaway project → its requirements gone).

**Manual verification checklist:**
- [ ] Requirements: admin creates/updates/removes a requirement; non-admin gets 403.
- [ ] Gap calc: requirement with `min_count=2`, one covered user → `coveredCount=1`, `gap=1`; all covered → `gap=0`.
- [ ] Level threshold: a user at `Intermediate` does NOT count toward an `Advanced` requirement; `Advanced`/`Expert` DO.
- [ ] Endorse: user endorses another for a skill → count incremented; endorsing self → 400; duplicate → 409; endorser or admin can delete, others 403.
- [ ] Coverage: `orderBy=endorsements` sorts high→low; per-row `endorsementCount` correct.
- [ ] Cascade: deleting a project removes its requirements; deleting a user removes their endorsements (given + received).
- [ ] Seeds are idempotent — re-running `seed-demo.js` doesn't duplicate requirements/endorsements.

---

## 7. Out of scope (future)

- **Skill certification tracking with expiry + expiry notifications** — new `skill_certifications` table with `expires_at`; notification when a cert lapses.
- **Skill-driven task assignment suggestions** — link to existing `tasks` assignee flow (recommend assignee from skill match against a task's labels).

---

## 8. Pre-deploy sanity (from prior lessons — do NOT skip)

1. **Migration index ordering** — these are new-table indexes (safe in `db.exec`). If any *later* migration ever adds a column + index, keep the index inside that migration's `up()`.
2. **Test against a LIVE-DB copy** (with `-wal`/`-shm`), not a fresh DB.
3. **RBAC** — `viewer` sees read-only (coverage + requirements read); member can endorse + edit own; admin edits requirements + catalog + anyone's endorsements. Gate requirement writes and catalog writes to admin.
4. **No self-endorsement** in the API, and disable the Endorse action on the current user's own coverage cells.
