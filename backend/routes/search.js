import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ projects: [], tasks: [], comments: [] });
  }

  const like = `%${q}%`;

  const projects = db.prepare(`
    SELECT id, name, color
    FROM projects
    WHERE deleted_at IS NULL AND (name LIKE ? OR description LIKE ?)
    ORDER BY name ASC
    LIMIT 10
  `).all(like, like);

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.project_id, p.name as project_name, t.status
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.deleted_at IS NULL AND (t.title LIKE ? OR t.description LIKE ? OR t.labels LIKE ?)
    ORDER BY t.title ASC
    LIMIT 10
  `).all(like, like, like);

  const comments = db.prepare(`
    SELECT c.id, c.body, c.task_id, t.project_id, t.title as task_title, u.name as user_name
    FROM comments c
    JOIN tasks t ON t.id = c.task_id
    JOIN users u ON u.id = c.user_id
    WHERE t.deleted_at IS NULL AND c.body LIKE ?
    ORDER BY c.created_at DESC
    LIMIT 10
  `).all(like);

  res.json({ projects, tasks, comments });
});

export default router;
