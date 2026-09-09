import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

function canEditProfile(req, userId) {
  return req.user.id === Number(userId) || req.user.role === 'admin';
}

function getSkill(id) {
  return db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM user_skills us WHERE us.skill_id = s.id) as userCount
    FROM skills s
    WHERE s.id = ?
  `).get(id);
}

// ---------- Catalog ----------

router.get('/', (req, res) => {
  const skills = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM user_skills us WHERE us.skill_id = s.id) as userCount
    FROM skills s
    ORDER BY s.category ASC, s.name ASC
  `).all();

  res.json(skills.map(s => ({ ...s, userCount: s.userCount || 0 })));
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, category, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const existing = db.prepare('SELECT id FROM skills WHERE name = ?').get(name.trim());
  if (existing) return res.status(409).json({ error: 'Skill already exists' });

  const result = db.prepare(
    'INSERT INTO skills (name, category, description) VALUES (?, ?, ?)'
  ).run(name.trim(), category || '', description || '');

  const skill = getSkill(result.lastInsertRowid);
  logActivity(req.user.id, 'skill.created', 'skill', skill.id, skill.name);
  res.status(201).json({ ...skill, userCount: 0 });
});

router.patch('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  if (req.body.name !== undefined) {
    if (!req.body.name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    const existing = db.prepare('SELECT id FROM skills WHERE name = ? AND id != ?').get(req.body.name.trim(), id);
    if (existing) return res.status(409).json({ error: 'Skill already exists' });
  }

  const fields = ['name', 'category', 'description'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'name' ? req.body[f].trim() : req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(getSkill(id));

  values.push(id);
  db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = getSkill(id);
  logActivity(req.user.id, 'skill.updated', 'skill', updated.id, updated.name);
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  db.prepare('DELETE FROM skills WHERE id = ?').run(id);

  logActivity(req.user.id, 'skill.deleted', 'skill', id, skill.name);
  res.json({ success: true });
});

// ---------- User profile ----------

router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const skills = db.prepare(`
    SELECT us.skill_id, s.name, s.category, s.description, us.level, us.years_experience
    FROM user_skills us
    JOIN skills s ON s.id = us.skill_id
    WHERE us.user_id = ?
    ORDER BY s.category ASC, s.name ASC
  `).all(userId);

  const endorsementCounts = db.prepare(`
    SELECT skill_id, COUNT(*) as count
    FROM skill_endorsements
    WHERE user_id = ?
    GROUP BY skill_id
  `).all(userId);
  const endorsementMap = {};
  for (const e of endorsementCounts) endorsementMap[e.skill_id] = e.count;

  res.json({
    userId: user.id,
    userName: user.name,
    skills: skills.map(s => ({
      skillId: s.skill_id,
      name: s.name,
      category: s.category,
      description: s.description,
      level: s.level,
      yearsExperience: s.years_experience,
      endorsements: endorsementMap[s.skill_id] || 0
    }))
  });
});

router.put('/user/:userId', (req, res) => {
  const { userId } = req.params;
  if (!canEditProfile(req, userId)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { skillId, level, yearsExperience } = req.body;
  if (!skillId) return res.status(400).json({ error: 'skillId is required' });

  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  const nextLevel = level || 'Intermediate';
  if (!LEVELS.includes(nextLevel)) {
    return res.status(400).json({ error: 'Invalid level. Must be Beginner, Intermediate, Advanced, or Expert.' });
  }

  const years = yearsExperience != null ? Number(yearsExperience) : 0;

  db.prepare(`
    INSERT INTO user_skills (user_id, skill_id, level, years_experience)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, skill_id) DO UPDATE SET
      level = excluded.level,
      years_experience = excluded.years_experience,
      updated_at = datetime('now')
  `).run(userId, skillId, nextLevel, years);

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
  logActivity(req.user.id, 'user.skill_set', 'user_skill', userId, user ? user.name : null, { skillId, level: nextLevel, yearsExperience: years });
  res.json({ success: true });
});

router.delete('/user/:userId/:skillId', (req, res) => {
  const { userId, skillId } = req.params;
  if (!canEditProfile(req, userId)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const row = db.prepare('SELECT id FROM user_skills WHERE user_id = ? AND skill_id = ?').get(userId, skillId);
  if (!row) return res.status(404).json({ error: 'Skill not found for user' });

  db.prepare('DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?').run(userId, skillId);

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
  logActivity(req.user.id, 'user.skill_removed', 'user_skill', userId, user ? user.name : null, { skillId });
  res.json({ success: true });
});

// ---------- Coverage ----------

router.get('/coverage', (req, res) => {
  const { skill, level, q, orderBy } = req.query;

  const conditions = [];
  const values = [];

  if (q) {
    conditions.push('u.name LIKE ?');
    values.push(`%${q}%`);
  }

  if (skill) {
    if (/^\d+$/.test(skill)) {
      conditions.push('s.id = ?');
      values.push(Number(skill));
    } else {
      conditions.push('s.name = ?');
      values.push(skill);
    }
  }

  if (level) {
    const minIdx = LEVELS.indexOf(level);
    if (minIdx === -1) return res.status(400).json({ error: 'Invalid level' });
    const allowed = LEVELS.slice(minIdx);
    conditions.push(`us.level IN (${allowed.map(() => '?').join(', ')})`);
    values.push(...allowed);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderClause = orderBy === 'endorsements'
    ? 'endorsementCount DESC, u.name ASC, s.name ASC'
    : 'u.name ASC, s.category ASC, s.name ASC';

  const rows = db.prepare(`
    SELECT us.user_id, u.name as user_name, us.skill_id, s.name as skill_name,
           s.category, us.level, us.years_experience,
           (SELECT COUNT(*) FROM skill_endorsements se
             WHERE se.user_id = us.user_id AND se.skill_id = us.skill_id) as endorsementCount
    FROM user_skills us
    JOIN users u ON u.id = us.user_id
    JOIN skills s ON s.id = us.skill_id
    ${where}
    ORDER BY ${orderClause}
  `).all(...values);

  res.json(rows.map(r => ({
    userId: r.user_id,
    userName: r.user_name,
    skillId: r.skill_id,
    skillName: r.skill_name,
    category: r.category,
    level: r.level,
    yearsExperience: r.years_experience,
    endorsementCount: r.endorsementCount || 0
  })));
});

// ---------- Project skill requirements ----------

router.get('/project/:projectId/requirements', (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const reqs = db.prepare(`
    SELECT r.project_id, r.skill_id, s.name as skill_name, s.category,
           r.min_level, r.min_count
    FROM project_skill_requirements r
    JOIN skills s ON s.id = r.skill_id
    WHERE r.project_id = ?
    ORDER BY s.category ASC, s.name ASC
  `).all(projectId);

  const result = reqs.map(r => {
    const minIdx = LEVELS.indexOf(r.min_level);
    const allowed = LEVELS.slice(minIdx);
    const covered = db.prepare(`
      SELECT us.user_id, u.name as user_name, us.level
      FROM user_skills us
      JOIN users u ON u.id = us.user_id
      WHERE us.skill_id = ? AND us.level IN (${allowed.map(() => '?').join(', ')})
      ORDER BY us.level DESC, u.name ASC
    `).all(r.skill_id, ...allowed);

    const coveredCount = covered.length;
    return {
      projectId: r.project_id,
      skillId: r.skill_id,
      skillName: r.skill_name,
      category: r.category,
      minLevel: r.min_level,
      minCount: r.min_count,
      coveredCount,
      coveredUsers: covered.map(c => ({ userId: c.user_id, userName: c.user_name, level: c.level })),
      gap: Math.max(0, r.min_count - coveredCount)
    };
  });

  res.json(result);
});

router.put('/project/:projectId/requirements/:skillId', requireRole('admin'), (req, res) => {
  const { projectId, skillId } = req.params;
  const { minLevel, minCount } = req.body;

  const project = db.prepare('SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const skill = db.prepare('SELECT id, name FROM skills WHERE id = ?').get(skillId);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  const nextLevel = minLevel || 'Intermediate';
  if (!LEVELS.includes(nextLevel)) {
    return res.status(400).json({ error: 'Invalid minLevel. Must be Beginner, Intermediate, Advanced, or Expert.' });
  }

  const count = minCount != null ? Number(minCount) : 1;
  if (!Number.isInteger(count) || count < 1) {
    return res.status(400).json({ error: 'minCount must be an integer >= 1' });
  }

  db.prepare(`
    INSERT INTO project_skill_requirements (project_id, skill_id, min_level, min_count)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, skill_id) DO UPDATE SET
      min_level = excluded.min_level,
      min_count = excluded.min_count,
      updated_at = datetime('now')
  `).run(projectId, skillId, nextLevel, count);

  const row = db.prepare(`
    SELECT r.*, s.name as skill_name, s.category
    FROM project_skill_requirements r
    JOIN skills s ON s.id = r.skill_id
    WHERE r.project_id = ? AND r.skill_id = ?
  `).get(projectId, skillId);

  logActivity(req.user.id, 'project.skill_required', 'project', projectId, project.name, { skillId, minLevel: nextLevel, minCount: count });
  res.json({
    projectId: row.project_id,
    skillId: row.skill_id,
    skillName: row.skill_name,
    category: row.category,
    minLevel: row.min_level,
    minCount: row.min_count
  });
});

router.delete('/project/:projectId/requirements/:skillId', requireRole('admin'), (req, res) => {
  const { projectId, skillId } = req.params;

  const project = db.prepare('SELECT id, name FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const row = db.prepare('SELECT id FROM project_skill_requirements WHERE project_id = ? AND skill_id = ?').get(projectId, skillId);
  if (!row) return res.status(404).json({ error: 'Requirement not found' });

  db.prepare('DELETE FROM project_skill_requirements WHERE project_id = ? AND skill_id = ?').run(projectId, skillId);

  logActivity(req.user.id, 'project.skill_requirement_removed', 'project', projectId, project.name, { skillId });
  res.json({ success: true });
});

// ---------- Skill endorsements ----------

router.get('/endorsements', (req, res) => {
  const { user, skill, endorser } = req.query;

  const conditions = [];
  const values = [];

  if (user) {
    if (/^\d+$/.test(user)) {
      conditions.push('u.id = ?');
      values.push(Number(user));
    } else {
      conditions.push('u.name = ?');
      values.push(user);
    }
  }

  if (skill) {
    if (/^\d+$/.test(skill)) {
      conditions.push('s.id = ?');
      values.push(Number(skill));
    } else {
      conditions.push('s.name = ?');
      values.push(skill);
    }
  }

  if (endorser) {
    if (/^\d+$/.test(endorser)) {
      conditions.push('e.id = ?');
      values.push(Number(endorser));
    } else {
      conditions.push('e.name = ?');
      values.push(endorser);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT se.id, se.endorser_id, se.user_id, se.skill_id, se.note, se.created_at,
           er.name as endorser_name, u.name as user_name, s.name as skill_name
    FROM skill_endorsements se
    JOIN users er ON er.id = se.endorser_id
    JOIN users u ON u.id = se.user_id
    JOIN skills s ON s.id = se.skill_id
    ${where}
    ORDER BY se.created_at DESC
  `).all(...values);

  res.json(rows.map(r => ({
    id: r.id,
    endorserId: r.endorser_id,
    endorserName: r.endorser_name,
    userId: r.user_id,
    userName: r.user_name,
    skillId: r.skill_id,
    skillName: r.skill_name,
    note: r.note,
    createdAt: r.created_at
  })));
});

router.post('/endorsements', (req, res) => {
  const { userId, skillId, note } = req.body;

  if (!userId || !skillId) return res.status(400).json({ error: 'userId and skillId are required' });

  if (Number(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot endorse yourself' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  const existing = db.prepare('SELECT id FROM skill_endorsements WHERE endorser_id = ? AND user_id = ? AND skill_id = ?')
    .get(req.user.id, userId, skillId);
  if (existing) return res.status(409).json({ error: 'Already endorsed' });

  const result = db.prepare(`
    INSERT INTO skill_endorsements (endorser_id, user_id, skill_id, note)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, userId, skillId, note || '');

  const row = db.prepare(`
    SELECT se.id, se.endorser_id, se.user_id, se.skill_id, se.note, se.created_at,
           er.name as endorser_name, u.name as user_name, s.name as skill_name
    FROM skill_endorsements se
    JOIN users er ON er.id = se.endorser_id
    JOIN users u ON u.id = se.user_id
    JOIN skills s ON s.id = se.skill_id
    WHERE se.id = ?
  `).get(result.lastInsertRowid);

  logActivity(req.user.id, 'user.skill_endorsed', 'user', userId, row.user_name, { skillId, skillName: row.skill_name });
  res.status(201).json({
    id: row.id,
    endorserId: row.endorser_id,
    endorserName: row.endorser_name,
    userId: row.user_id,
    userName: row.user_name,
    skillId: row.skill_id,
    skillName: row.skill_name,
    note: row.note,
    createdAt: row.created_at
  });
});

router.delete('/endorsements/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare(`
    SELECT se.*, u.name as user_name, s.name as skill_name
    FROM skill_endorsements se
    JOIN users u ON u.id = se.user_id
    JOIN skills s ON s.id = se.skill_id
    WHERE se.id = ?
  `).get(id);
  if (!row) return res.status(404).json({ error: 'Endorsement not found' });

  if (row.endorser_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  db.prepare('DELETE FROM skill_endorsements WHERE id = ?').run(id);

  logActivity(req.user.id, 'user.skill_endorsement_removed', 'user', row.user_id, row.user_name, { skillId: row.skill_id, skillName: row.skill_name });
  res.json({ success: true });
});

export default router;
