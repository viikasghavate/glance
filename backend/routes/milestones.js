import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

const VALID_STATUS = ['open', 'completed'];

function isValidDate(value) {
  if (value == null || value === '') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function getMilestone(id) {
  return db.prepare(`
    SELECT m.*, (SELECT COUNT(*) FROM tasks t WHERE t.milestone_id = m.id AND t.deleted_at IS NULL) as task_count
    FROM milestones m
    WHERE m.id = ?
  `).get(id);
}

router.get('/projects/:projectId/milestones', (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const milestones = db.prepare(`
    SELECT m.*, (SELECT COUNT(*) FROM tasks t WHERE t.milestone_id = m.id AND t.deleted_at IS NULL) as task_count
    FROM milestones m
    WHERE m.project_id = ?
    ORDER BY m.due_date ASC, m.id ASC
  `).all(projectId);
  res.json(milestones);
});

router.post('/projects/:projectId/milestones', requireRole('admin', 'member'), (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, description, due_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!isValidDate(due_date)) return res.status(400).json({ error: 'Invalid due_date format (expected YYYY-MM-DD)' });

  const result = db.prepare(
    'INSERT INTO milestones (project_id, name, description, due_date) VALUES (?, ?, ?, ?)'
  ).run(projectId, name, description || '', due_date || null);

  const milestone = getMilestone(result.lastInsertRowid);
  logActivity(req.user.id, 'milestone.created', 'milestone', milestone.id, milestone.name);
  res.status(201).json(milestone);
});

router.patch('/milestones/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
  if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

  if (req.body.status !== undefined && !VALID_STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  if (req.body.due_date !== undefined && !isValidDate(req.body.due_date)) return res.status(400).json({ error: 'Invalid due_date format (expected YYYY-MM-DD)' });

  const fields = ['name', 'description', 'due_date', 'status'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(getMilestone(id));

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = getMilestone(id);
  logActivity(req.user.id, 'milestone.updated', 'milestone', updated.id, updated.name);
  res.json(updated);
});

router.delete('/milestones/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
  if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

  const txn = db.transaction(() => {
    db.prepare('UPDATE tasks SET milestone_id = NULL, updated_at = datetime(\'now\') WHERE milestone_id = ?').run(id);
    db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
  });
  txn();

  logActivity(req.user.id, 'milestone.deleted', 'milestone', id, milestone.name);
  res.json({ success: true });
});

export default router;
