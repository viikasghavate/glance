import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const projects = db.prepare(
    includeArchived
      ? 'SELECT * FROM projects ORDER BY created_at DESC'
      : 'SELECT * FROM projects WHERE archived = 0 ORDER BY created_at DESC'
  ).all();

  const stmt = db.prepare(`
    SELECT project_id, status, COUNT(*) as count
    FROM tasks
    WHERE project_id IN (${projects.map(() => '?').join(',') || '0'})
    GROUP BY project_id, status
  `);
  const counts = stmt.all(...projects.map(p => p.id));

  const countMap = {};
  for (const c of counts) {
    if (!countMap[c.project_id]) countMap[c.project_id] = { todo: 0, in_progress: 0, done: 0 };
    countMap[c.project_id][c.status] = c.count;
  }

  const result = projects.map(p => ({
    ...p,
    archived: !!p.archived,
    taskCounts: countMap[p.id] || { todo: 0, in_progress: 0, done: 0 }
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(
    'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)'
  ).run(name, description || '', color || '#6366f1');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  project.archived = !!project.archived;
  project.taskCounts = { todo: 0, in_progress: 0, done: 0 };
  res.status(201).json(project);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  project.archived = !!project.archived;
  res.json(project);
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const fields = ['name', 'description', 'color', 'archived'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'archived' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(project);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  updated.archived = !!updated.archived;
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
