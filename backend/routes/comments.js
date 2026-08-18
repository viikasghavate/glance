import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { notifyCommentAdded } from '../services/notifications.js';

const router = Router();

router.use(requireAuth);

router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c
    JOIN users u ON c.user_id = u.id
    JOIN tasks t ON t.id = c.task_id
    WHERE c.task_id = ? AND t.deleted_at IS NULL
    ORDER BY c.created_at ASC
  `).all(taskId);
  res.json(comments);
});

router.post('/task/:taskId', requireRole('admin', 'member'), (req, res) => {
  const { taskId } = req.params;
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });

  const task = db.prepare('SELECT id, title, assignee_id, reporter_id, project_id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(taskId);
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

  logActivity(req.user.id, 'comment.added', 'comment', comment.id, task ? task.title : null, { task_id: taskId });

  notifyCommentAdded(task, req.user.id, body);

  res.status(201).json(comment);
});

export default router;
