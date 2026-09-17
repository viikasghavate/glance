import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

export async function recomputeTimeSpent(taskId) {
  const row = await db.prepare('SELECT COALESCE(SUM(minutes), 0) as total FROM time_entries WHERE task_id = ?').get(taskId);
  const hours = Math.round((row.total / 60) * 100) / 100;
  await db.prepare('UPDATE tasks SET time_spent = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hours, taskId);
  return hours;
}

function buildFilters(req) {
  const { project_id, user_id, from, to, min_minutes } = req.query;
  const conditions = ['t.deleted_at IS NULL'];
  const values = [];

  if (from !== undefined && from !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || Number.isNaN(Date.parse(from))) {
      return { error: 'Invalid date' };
    }
    conditions.push('e.created_at >= ?');
    values.push(`${from} 00:00:00`);
  }
  if (to !== undefined && to !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(Date.parse(to))) {
      return { error: 'Invalid date' };
    }
    conditions.push('e.created_at <= ?');
    values.push(`${to} 23:59:59`);
  }

  if (project_id !== undefined && project_id !== '') {
    conditions.push('t.project_id = ?');
    values.push(project_id);
  }
  if (user_id !== undefined && user_id !== '') {
    conditions.push('e.user_id = ?');
    values.push(user_id);
  }
  if (min_minutes !== undefined && min_minutes !== '') {
    conditions.push('e.minutes >= ?');
    values.push(min_minutes);
  }

  return { conditions, values };
}

router.get('/', async (req, res) => {
  const filters = buildFilters(req);
  if (filters.error) return res.status(400).json({ error: filters.error });

  const where = filters.conditions.length > 0 ? `WHERE ${filters.conditions.join(' AND ')}` : '';
  const entries = await db.prepare(`
    SELECT e.*, u.name as user_name, t.title as task_title, t.project_id
    FROM time_entries e
    LEFT JOIN users u ON u.id = e.user_id
    JOIN tasks t ON t.id = e.task_id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT 500
  `).all(...filters.values);
  res.json(entries);
});

function csvEscape(value) {
  if (value == null) return '';
  return '"' + String(value).replace(/"/g, '""') + '"';
}

router.get('/export', async (req, res) => {
  const filters = buildFilters(req);
  if (filters.error) return res.status(400).json({ error: filters.error });

  const where = filters.conditions.length > 0 ? `WHERE ${filters.conditions.join(' AND ')}` : '';
  const rows = await db.prepare(`
    SELECT e.*, u.name as user_name, t.title as task_title, t.project_id
    FROM time_entries e
    LEFT JOIN users u ON u.id = e.user_id
    JOIN tasks t ON t.id = e.task_id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT 5000
  `).all(...filters.values);

  const headers = ['id', 'task', 'task_id', 'project_id', 'user', 'minutes', 'hours', 'note', 'created_at'];

  const dataRows = rows.map(e => [
    e.id,
    e.task_title || '',
    e.task_id,
    e.project_id,
    e.user_name || '',
    e.minutes,
    e.minutes != null ? (e.minutes / 60).toFixed(2) : '',
    e.note || '',
    e.created_at
  ]);

  const csv = [headers, ...dataRows].map(row => row.map(csvEscape).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="time-entries.csv"');
  res.send(csv);
});

router.delete('/:id', requireRole('admin', 'member'), async (req, res) => {
  const { id } = req.params;
  const entry = await db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
  if (!entry) return res.status(404).json({ error: 'Time entry not found' });

  await db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  await recomputeTimeSpent(entry.task_id);

  res.json({ success: true });
});

export default router;
