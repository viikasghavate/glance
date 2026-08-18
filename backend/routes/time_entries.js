import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

export function recomputeTimeSpent(taskId) {
  const row = db.prepare('SELECT COALESCE(SUM(minutes), 0) as total FROM time_entries WHERE task_id = ?').get(taskId);
  const hours = Math.round((row.total / 60) * 100) / 100;
  db.prepare('UPDATE tasks SET time_spent = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hours, taskId);
  return hours;
}

router.get('/', (req, res) => {
  const entries = db.prepare(`
    SELECT e.*, u.name as user_name, t.title as task_title, t.project_id
    FROM time_entries e
    LEFT JOIN users u ON u.id = e.user_id
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL
    ORDER BY e.created_at DESC
    LIMIT 500
  `).all();
  res.json(entries);
});

router.delete('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
  if (!entry) return res.status(404).json({ error: 'Time entry not found' });

  db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  recomputeTimeSpent(entry.task_id);

  res.json({ success: true });
});

export default router;
