import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

const VALID_STATUS = ['planned', 'active', 'completed'];

function isValidDate(value) {
  if (value == null || value === '') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function getSprint(id) {
  return db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.deleted_at IS NULL) as task_count
    FROM sprints s
    WHERE s.id = ?
  `).get(id);
}

router.get('/projects/:projectId/sprints', (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const sprints = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.deleted_at IS NULL) as task_count
    FROM sprints s
    WHERE s.project_id = ?
    ORDER BY s.start_date ASC, s.id ASC
  `).all(projectId);
  res.json(sprints);
});

router.post('/projects/:projectId/sprints', requireRole('admin', 'member'), (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, goal, start_date, end_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!isValidDate(start_date)) return res.status(400).json({ error: 'Invalid start_date format (expected YYYY-MM-DD)' });
  if (!isValidDate(end_date)) return res.status(400).json({ error: 'Invalid end_date format (expected YYYY-MM-DD)' });

  const result = db.prepare(
    'INSERT INTO sprints (project_id, name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
  ).run(projectId, name, goal || '', start_date || null, end_date || null);

  const sprint = getSprint(result.lastInsertRowid);
  logActivity(req.user.id, 'sprint.created', 'sprint', sprint.id, sprint.name);
  res.status(201).json(sprint);
});

router.patch('/sprints/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

  if (req.body.status !== undefined && !VALID_STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  if (req.body.start_date !== undefined && !isValidDate(req.body.start_date)) return res.status(400).json({ error: 'Invalid start_date format (expected YYYY-MM-DD)' });
  if (req.body.end_date !== undefined && !isValidDate(req.body.end_date)) return res.status(400).json({ error: 'Invalid end_date format (expected YYYY-MM-DD)' });

  const fields = ['name', 'goal', 'start_date', 'end_date', 'status'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(getSprint(id));

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE sprints SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = getSprint(id);
  logActivity(req.user.id, 'sprint.updated', 'sprint', updated.id, updated.name);
  res.json(updated);
});

router.delete('/sprints/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

  const txn = db.transaction(() => {
    db.prepare('UPDATE tasks SET sprint_id = NULL, updated_at = datetime(\'now\') WHERE sprint_id = ?').run(id);
    db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
  });
  txn();

  logActivity(req.user.id, 'sprint.deleted', 'sprint', id, sprint.name);
  res.json({ success: true });
});

export default router;
