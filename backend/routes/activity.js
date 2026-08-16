import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const { project_id, entity_type, limit } = req.query;
  const conditions = [];
  const values = [];

  if (project_id) {
    conditions.push(`a.entity_type = 'task' AND t.project_id = ?`);
    values.push(project_id);
  }
  if (entity_type) {
    conditions.push('a.entity_type = ?');
    values.push(entity_type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitVal = Math.min(parseInt(limit, 10) || 50, 200);

  const rows = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN tasks t ON a.entity_type = 'task' AND a.entity_id = t.id
    ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?
  `).all(...values, limitVal);

  res.json(rows);
});

export default router;
