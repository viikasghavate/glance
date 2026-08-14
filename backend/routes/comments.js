import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId);
  res.json(comments);
});

router.post('/task/:taskId', requireRole('admin', 'member'), (req, res) => {
  const { taskId } = req.params;
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const result = db.prepare(
    'INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)'
  ).run(taskId, req.user.id, body);

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

export default router;
