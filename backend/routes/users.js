import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

router.patch('/me', async (req, res) => {
  const { name, email } = req.body;
  const id = req.user.id;

  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
  }

  if (email !== undefined) {
    if (!email.trim()) return res.status(400).json({ error: 'Email cannot be empty' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim(), id);
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim(), id);
  }

  const updated = await db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(id);
  logActivity(req.user.id, 'user.updated_self', 'user', updated.id, updated.name);
  res.json(updated);
});

router.patch('/me/password', async (req, res) => {
  const { currentPassword, password } = req.body;
  const id = req.user.id;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const user = await db.prepare('SELECT id, name, password_hash FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  logActivity(req.user.id, 'user.password_changed_self', 'user', user.id, user.name);
  res.json({ success: true });
});

async function isLastAdmin(targetUserId) {
  const target = await db.prepare('SELECT role FROM users WHERE id = ?').get(targetUserId);
  if (!target || target.role !== 'admin') return false;
  const adminCount = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  return adminCount.count <= 1;
}

router.get('/', async (req, res) => {
  const users = await db.prepare(`
    SELECT
      u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
      (SELECT COUNT(*) FROM projects WHERE owner_id = u.id AND deleted_at IS NULL) as projects_owned,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND deleted_at IS NULL) as tasks_assigned,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND deleted_at IS NULL AND status = 'done') as tasks_completed,
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

router.post('/', requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer.' });
  }

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, hash, name, role);
  const user = await db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  logActivity(req.user.id, 'user.created', 'user', user.id, user.name, { role });
  res.status(201).json(user);
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
  }

  if (email !== undefined) {
    if (!email.trim()) return res.status(400).json({ error: 'Email cannot be empty' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim(), id);
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim(), id);
  }

  const updated = await db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(id);
  res.json(updated);
});

router.patch('/:id/role', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const requesterId = req.user.id;

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer.' });
  }

  const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'admin' && role !== 'admin' && await isLastAdmin(Number(id))) {
    return res.status(400).json({ error: 'Cannot change the role of the last admin.' });
  }

  if (Number(id) === requesterId && role !== 'admin' && await isLastAdmin(requesterId)) {
    return res.status(400).json({ error: 'You cannot demote yourself as the last admin.' });
  }

  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  const updated = await db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(id);
  logActivity(req.user.id, 'user.role_changed', 'user', updated.id, updated.name, { from: user.role, to: role });
  res.json(updated);
});

router.patch('/:id/password', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const user = await db.prepare('SELECT id, name FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  logActivity(req.user.id, 'user.password_reset', 'user', user.id, user.name);
  res.json({ success: true });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user.id;

  const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (await isLastAdmin(Number(id))) {
    return res.status(400).json({ error: 'Cannot remove the last admin.' });
  }

  if (Number(id) === requesterId && await isLastAdmin(requesterId)) {
    return res.status(400).json({ error: 'You cannot remove yourself as the last admin.' });
  }

  const cleanup = db.transaction(async () => {
    await db.prepare('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?').run(id);
    await db.prepare('UPDATE tasks SET reporter_id = NULL WHERE reporter_id = ?').run(id);
    await db.prepare('UPDATE projects SET owner_id = NULL WHERE owner_id = ?').run(id);
    await db.prepare('DELETE FROM comments WHERE user_id = ?').run(id);
    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  await cleanup();
  logActivity(req.user.id, 'user.deleted', 'user', id, user.name);
  res.json({ success: true });
});

export default router;
