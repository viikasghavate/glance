import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

function isLastAdmin(targetUserId) {
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(targetUserId);
  if (!target || target.role !== 'admin') return false;
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  return adminCount.count <= 1;
}

router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
      (SELECT COUNT(*) FROM projects WHERE owner_id = u.id) as projects_owned,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id) as tasks_assigned,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND status = 'done') as tasks_completed,
      (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as comments
    FROM users u
    ORDER BY u.name ASC
  `).all();

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
    stats: {
      projectsOwned: u.projects_owned,
      tasksAssigned: u.tasks_assigned,
      tasksCompleted: u.tasks_completed,
      comments: u.comments
    }
  }));

  res.json(result);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, hash, name, role);
  const user = db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

router.patch('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
  }

  if (email !== undefined) {
    if (!email.trim()) return res.status(400).json({ error: 'Email cannot be empty' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim(), id);
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim(), id);
  }

  const updated = db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(id);
  res.json(updated);
});

router.patch('/:id/role', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const requesterId = req.user.id;

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer.' });
  }

  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'admin' && role !== 'admin' && isLastAdmin(Number(id))) {
    return res.status(400).json({ error: 'Cannot change the role of the last admin.' });
  }

  if (Number(id) === requesterId && role !== 'admin' && isLastAdmin(requesterId)) {
    return res.status(400).json({ error: 'You cannot demote yourself as the last admin.' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  const updated = db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const requesterId = req.user.id;

  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (isLastAdmin(Number(id))) {
    return res.status(400).json({ error: 'Cannot remove the last admin.' });
  }

  if (Number(id) === requesterId && isLastAdmin(requesterId)) {
    return res.status(400).json({ error: 'You cannot remove yourself as the last admin.' });
  }

  const cleanup = db.transaction(() => {
    db.prepare('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?').run(id);
    db.prepare('UPDATE tasks SET reporter_id = NULL WHERE reporter_id = ?').run(id);
    db.prepare('UPDATE projects SET owner_id = NULL WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM comments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  cleanup();
  res.json({ success: true });
});

export default router;
