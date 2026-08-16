import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

function getDescendantIds(taskId) {
  const ids = new Set();
  const queue = [taskId];
  while (queue.length > 0) {
    const current = queue.shift();
    const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ?').all(current);
    for (const child of children) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return ids;
}

function getDependencies(taskId) {
  const blockedBy = db.prepare(`
    SELECT t.id, t.title, t.status
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.depends_on_id
    WHERE d.task_id = ?
    ORDER BY t.id ASC
  `).all(taskId);

  const blocks = db.prepare(`
    SELECT t.id, t.title, t.status
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.task_id
    WHERE d.depends_on_id = ?
    ORDER BY t.id ASC
  `).all(taskId);

  return { blockedBy, blocks };
}

function getTaskWithDeps(id) {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
           r.name as reporter_name, r.email as reporter_email,
           (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) as subtask_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users r ON t.reporter_id = r.id
    WHERE t.id = ?
  `).get(id);
  if (!task) return null;
  const deps = getDependencies(id);
  const checklist = db.prepare(
    'SELECT COUNT(*) as total, COALESCE(SUM(completed), 0) as completed FROM task_checklist WHERE task_id = ?'
  ).get(id);
  return { ...task, ...deps, checklist_progress: { total: checklist.total, completed: checklist.completed || 0 } };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function addYears(dateStr, years) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function computeNextDate(recurrence, baseDate) {
  if (!baseDate) return null;
  switch (recurrence) {
    case 'daily': return addDays(baseDate, 1);
    case 'weekly': return addDays(baseDate, 7);
    case 'monthly': return addMonths(baseDate, 1);
    case 'yearly': return addYears(baseDate, 1);
    default: return null;
  }
}

function createNextOccurrence(task) {
  const recurrence = task.recurrence;
  if (!recurrence || recurrence === 'none') return;

  const baseDate = task.due_date || task.start_date || task.created_at;
  const nextDue = computeNextDate(recurrence, baseDate);
  if (!nextDue) return;

  if (task.recurrence_end && nextDue > task.recurrence_end) return;

  const nextStart = task.start_date ? computeNextDate(recurrence, task.start_date) : null;

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM tasks WHERE project_id = ? AND status = ?'
  ).get(task.project_id, 'todo');

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.project_id,
    task.title,
    task.description || '',
    'todo',
    task.priority || 'medium',
    nextDue,
    task.assignee_id || null,
    maxPos.maxPos + 1,
    task.labels || '',
    nextStart,
    task.estimated_hours != null ? task.estimated_hours : null,
    0,
    task.reporter_id || null,
    0,
    task.parent_id || null,
    recurrence,
    task.recurrence_end || null
  );

  const newId = result.lastInsertRowid;

  const deps = db.prepare('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?').all(task.id);
  const insertDep = db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)');
  for (const d of deps) {
    insertDep.run(newId, d.depends_on_id);
  }
}

router.get('/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
           r.name as reporter_name, r.email as reporter_email,
           (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) as subtask_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users r ON t.reporter_id = r.id
    WHERE t.project_id = ?
    ORDER BY t.position ASC, t.created_at DESC
  `).all(projectId);

  const result = tasks.map(t => ({ ...t, ...getDependencies(t.id) }));

  res.json(result);
});

router.post('/project/:projectId', requireRole('admin', 'member'), (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { title, description, status, priority, due_date, assignee_id, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  if (parent_id != null) {
    const parent = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parent_id);
    if (!parent) return res.status(400).json({ error: 'Parent task not found' });
    if (parent.project_id !== Number(projectId)) return res.status(400).json({ error: 'Parent task must belong to the same project' });
  }

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM tasks WHERE project_id = ? AND status = ?'
  ).get(projectId, status || 'todo');

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    title,
    description || '',
    status || 'todo',
    priority || 'medium',
    due_date || null,
    assignee_id || null,
    maxPos.maxPos + 1,
    labels || '',
    start_date || null,
    estimated_hours != null ? estimated_hours : null,
    time_spent != null ? time_spent : 0,
    reporter_id || null,
    archived ? 1 : 0,
    parent_id || null,
    recurrence || 'none',
    recurrence_end || null
  );

  const task = getTaskWithDeps(result.lastInsertRowid);

  logActivity(req.user.id, 'task.created', 'task', task.id, task.title);

  res.status(201).json(task);
});

router.patch('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.body.parent_id !== undefined) {
    const newParentId = req.body.parent_id;
    if (newParentId != null) {
      if (Number(newParentId) === Number(id)) {
        return res.status(400).json({ error: 'A task cannot be its own parent' });
      }
      const parent = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newParentId);
      if (!parent) return res.status(400).json({ error: 'Parent task not found' });
      if (parent.project_id !== task.project_id) return res.status(400).json({ error: 'Parent task must belong to the same project' });
      const descendants = getDescendantIds(Number(id));
      if (descendants.has(Number(newParentId))) {
        return res.status(400).json({ error: 'Cannot set a descendant as parent (cycle detected)' });
      }
    }
  }

  const fields = ['title', 'description', 'status', 'priority', 'due_date', 'assignee_id', 'position', 'labels', 'start_date', 'estimated_hours', 'time_spent', 'reporter_id', 'archived', 'parent_id', 'recurrence', 'recurrence_end'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(getTaskWithDeps(id));

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = getTaskWithDeps(id);

  if (req.body.status !== undefined && req.body.status !== task.status) {
    logActivity(req.user.id, 'task.status_changed', 'task', updated.id, updated.title, { from: task.status, to: updated.status });
  }
  if (req.body.assignee_id !== undefined && Number(req.body.assignee_id || 0) !== Number(task.assignee_id || 0)) {
    logActivity(req.user.id, 'task.assigned', 'task', updated.id, updated.title);
  }
  if (req.body.title !== undefined && req.body.title !== task.title) {
    logActivity(req.user.id, 'task.updated', 'task', updated.id, updated.title, { field: 'title', from: task.title, to: updated.title });
  }
  if (req.body.priority !== undefined && req.body.priority !== task.priority) {
    logActivity(req.user.id, 'task.updated', 'task', updated.id, updated.title, { field: 'priority', from: task.priority, to: updated.priority });
  }
  if (req.body.due_date !== undefined && req.body.due_date !== task.due_date) {
    logActivity(req.user.id, 'task.updated', 'task', updated.id, updated.title, { field: 'due_date', from: task.due_date, to: updated.due_date });
  }

  if (req.body.status === 'done' && task.status !== 'done') {
    createNextOccurrence(updated);
  }

  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('UPDATE tasks SET parent_id = NULL WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

  logActivity(req.user.id, 'task.deleted', 'task', id, task.title);

  res.json({ success: true });
});

router.post('/:id/reorder', requireRole('admin', 'member'), (req, res) => {
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

  const updated = getTaskWithDeps(id);

  if (status !== undefined && status !== oldStatus) {
    logActivity(req.user.id, 'task.status_changed', 'task', updated.id, updated.title, { from: oldStatus, to: status });
    if (status === 'done' && oldStatus !== 'done') {
      createNextOccurrence(updated);
    }
  }

  res.json(updated);
});

router.post('/:id/dependencies', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const { depends_on_id } = req.body;

  if (depends_on_id == null) return res.status(400).json({ error: 'depends_on_id is required' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const dep = db.prepare('SELECT * FROM tasks WHERE id = ?').get(depends_on_id);
  if (!dep) return res.status(404).json({ error: 'Dependency task not found' });

  if (Number(id) === Number(depends_on_id)) {
    return res.status(400).json({ error: 'A task cannot depend on itself' });
  }
  if (task.project_id !== dep.project_id) {
    return res.status(400).json({ error: 'Dependency must belong to the same project' });
  }

  const existing = db.prepare('SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?').get(id, depends_on_id);
  if (existing) return res.status(400).json({ error: 'Dependency already exists' });

  const visited = new Set();
  const queue = [Number(depends_on_id)];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === Number(id)) {
      return res.status(400).json({ error: 'Cannot add dependency: cycle detected' });
    }
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = db.prepare('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?').all(current);
    for (const d of deps) queue.push(d.depends_on_id);
  }

  db.prepare('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)').run(id, depends_on_id);

  logActivity(req.user.id, 'task.dependency_added', 'task', id, task.title, { depends_on_id, depends_on_title: dep.title });

  res.status(201).json(getTaskWithDeps(id));
});

router.delete('/:id/dependencies/:dependsOnId', requireRole('admin', 'member'), (req, res) => {
  const { id, dependsOnId } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?').run(id, dependsOnId);

  logActivity(req.user.id, 'task.dependency_removed', 'task', id, task.title, { depends_on_id: dependsOnId });

  res.json(getTaskWithDeps(id));
});

router.delete('/:id/dependencies', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);

  logActivity(req.user.id, 'task.dependencies_cleared', 'task', id, task.title);

  res.json(getTaskWithDeps(id));
});

router.get('/:id/checklist', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const items = db.prepare(
    'SELECT * FROM task_checklist WHERE task_id = ? ORDER BY position ASC, id ASC'
  ).all(id);
  res.json(items);
});

router.post('/:id/checklist', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM task_checklist WHERE task_id = ?'
  ).get(id);

  const result = db.prepare(
    'INSERT INTO task_checklist (task_id, text, position) VALUES (?, ?, ?)'
  ).run(id, text.trim(), maxPos.maxPos + 1);

  const item = db.prepare('SELECT * FROM task_checklist WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.patch('/checklist/:itemId', requireRole('admin', 'member'), (req, res) => {
  const { itemId } = req.params;
  const item = db.prepare('SELECT * FROM task_checklist WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Checklist item not found' });

  const updates = [];
  const values = [];

  if (req.body.text !== undefined) {
    updates.push('text = ?');
    values.push(req.body.text);
  }
  if (req.body.completed !== undefined) {
    updates.push('completed = ?');
    values.push(req.body.completed ? 1 : 0);
  }

  if (updates.length === 0) return res.json(item);

  values.push(itemId);
  db.prepare(`UPDATE task_checklist SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  res.json(db.prepare('SELECT * FROM task_checklist WHERE id = ?').get(itemId));
});

router.delete('/checklist/:itemId', requireRole('admin', 'member'), (req, res) => {
  const { itemId } = req.params;
  const item = db.prepare('SELECT * FROM task_checklist WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Checklist item not found' });

  db.prepare('DELETE FROM task_checklist WHERE id = ?').run(itemId);
  res.json({ success: true });
});

router.post('/:id/checklist/reorder', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds is required' });

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const updatePos = db.prepare('UPDATE task_checklist SET position = ? WHERE id = ? AND task_id = ?');
  const txn = db.transaction(() => {
    orderedIds.forEach((itemId, index) => {
      updatePos.run(index, itemId, id);
    });
  });
  txn();

  const items = db.prepare(
    'SELECT * FROM task_checklist WHERE task_id = ? ORDER BY position ASC, id ASC'
  ).all(id);
  res.json(items);
});

export default router;
