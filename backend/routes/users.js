import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY name ASC').all();
  res.json(users);
});

router.patch('/:id/role', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  const updated = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(id);
  res.json(updated);
});

export default router;
