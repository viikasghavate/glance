import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ?
    ORDER BY t.position ASC, t.created_at DESC
  `).all(projectId);

  res.json(tasks);
});

router.post('/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { title, description, status, priority, due_date, assignee_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM tasks WHERE project_id = ? AND status = ?'
  ).get(projectId, status || 'todo');

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, assignee_id, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    title,
    description || '',
    status || 'todo',
    priority || 'medium',
    due_date || null,
    assignee_id || null,
    maxPos.maxPos + 1
  );

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const fields = ['title', 'description', 'status', 'priority', 'due_date', 'assignee_id', 'position'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(task);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(id);

  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

router.post('/:id/reorder', (req, res) => {
  const { id } = req.params;
  const { status, position } = req.body;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const oldStatus = task.status;
  const oldPosition = task.position;

  if (status !== undefined) {
    db.prepare('UPDATE tasks SET status = ?, position = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(status, position ?? 0, id);
  } else {
    db.prepare('UPDATE tasks SET position = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(position ?? 0, id);
  }

  const newStatus = status !== undefined ? status : oldStatus;

  const siblings = db.prepare(
    'SELECT id FROM tasks WHERE project_id = ? AND status = ? AND id != ? ORDER BY position ASC'
  ).all(task.project_id, newStatus, id);

  const updatePos = db.prepare('UPDATE tasks SET position = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const txn = db.transaction(() => {
    for (let i = 0; i < siblings.length; i++) {
      updatePos.run(i >= (position ?? 0) ? i + 1 : i, siblings[i].id);
    }
  });
  txn();

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(id);

  res.json(updated);
});

export default router;
