import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { project_id, entity_type, q, limit } = req.query;
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
  const trimmedQ = String(q || '').trim();
  if (trimmedQ) {
    conditions.push('(a.action LIKE ? OR a.entity_name LIKE ? OR a.entity_type LIKE ? OR u.name LIKE ? OR a.details LIKE ?)');
    const like = `%${trimmedQ}%`;
    values.push(like, like, like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitVal = Math.min(parseInt(limit, 10) || 50, 200);

  const rows = await db.prepare(`
    SELECT a.*, u.name as user_name, t.project_id as project_id
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN tasks t ON a.entity_type = 'task' AND a.entity_id = t.id AND t.deleted_at IS NULL
    ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?
  `).all(...values, limitVal);

  res.json(rows);
});

function csvEscape(value) {
  if (value == null) return '';
  return '"' + String(value).replace(/"/g, '""') + '"';
}

router.get('/export', async (req, res) => {
  const { project_id, entity_type, q } = req.query;
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
  const trimmedQ = String(q || '').trim();
  if (trimmedQ) {
    conditions.push('(a.action LIKE ? OR a.entity_name LIKE ? OR a.entity_type LIKE ? OR u.name LIKE ? OR a.details LIKE ?)');
    const like = `%${trimmedQ}%`;
    values.push(like, like, like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.prepare(`
    SELECT a.*, u.name as user_name, t.project_id as project_id
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN tasks t ON a.entity_type = 'task' AND a.entity_id = t.id AND t.deleted_at IS NULL
    ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 5000
  `).all(...values);

  const headers = ['id', 'time', 'user', 'action', 'entity_type', 'entity_name', 'details'];

  const dataRows = rows.map(a => [
    a.id,
    a.created_at,
    a.user_name || '',
    a.action,
    a.entity_type,
    a.entity_name,
    a.details
  ]);

  const csv = [headers, ...dataRows].map(row => row.map(csvEscape).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="activity-log.csv"');
  res.send(csv);
});

export default router;
