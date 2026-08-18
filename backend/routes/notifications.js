import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(notifications);
});

router.get('/unread-count', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id);
  res.json({ count: row.count });
});

router.post('/:id/read', (req, res) => {
  const { id } = req.params;
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });

  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  res.json(db.prepare('SELECT * FROM notifications WHERE id = ?').get(id));
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
  res.json({ success: true });
});

export default router;
