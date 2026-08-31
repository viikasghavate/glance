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

  res.json({
    userId: user.id,
    userName: user.name,
    skills: skills.map(s => ({
      skillId: s.skill_id,
      name: s.name,
      category: s.category,
      description: s.description,
      level: s.level,
      yearsExperience: s.years_experience
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
  const { skill, level, q } = req.query;

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

  const rows = db.prepare(`
    SELECT us.user_id, u.name as user_name, us.skill_id, s.name as skill_name,
           s.category, us.level, us.years_experience
    FROM user_skills us
    JOIN users u ON u.id = us.user_id
    JOIN skills s ON s.id = us.skill_id
    ${where}
    ORDER BY u.name ASC, s.category ASC, s.name ASC
  `).all(...values);

  res.json(rows.map(r => ({
    userId: r.user_id,
    userName: r.user_name,
    skillId: r.skill_id,
    skillName: r.skill_name,
    category: r.category,
    level: r.level,
    yearsExperience: r.years_experience
  })));
});

export default router;
