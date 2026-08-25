import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { syncTaskLabels, getTaskLabels } from '../services/tagging.js';
import { notifyTaskAssigned, notifyCommentAdded, notifyDependencyDone } from '../services/notifications.js';
import { recomputeTimeSpent } from './time_entries.js';

const router = Router();

router.use(requireAuth);

const VALID_STATUS = ['todo', 'in_progress', 'done'];
const VALID_PRIORITY = ['low', 'medium', 'high'];

function isValidDate(value) {
  if (value == null || value === '') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function getWatchers(taskId) {
  return db.prepare(`
    SELECT u.id, u.name, u.email
    FROM task_watchers w
    JOIN users u ON u.id = w.user_id
    WHERE w.task_id = ?
    ORDER BY u.name ASC
  `).all(taskId);
}

function getDescendantIds(taskId) {
  const ids = new Set();
  const queue = [taskId];
  while (queue.length > 0) {
    const current = queue.shift();
    const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND deleted_at IS NULL').all(current);
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
    WHERE d.task_id = ? AND t.deleted_at IS NULL
    ORDER BY t.id ASC
  `).all(taskId);

  const blocks = db.prepare(`
    SELECT t.id, t.title, t.status
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.task_id
    WHERE d.depends_on_id = ? AND t.deleted_at IS NULL
    ORDER BY t.id ASC
  `).all(taskId);

  return { blockedBy, blocks };
}

function getTaskWithDeps(id) {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
           r.name as reporter_name, r.email as reporter_email,
           s.name as sprint_name, m.name as milestone_name,
           (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND deleted_at IS NULL) as subtask_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users r ON t.reporter_id = r.id
    LEFT JOIN sprints s ON t.sprint_id = s.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    WHERE t.id = ? AND t.deleted_at IS NULL
  `).get(id);
  if (!task) return null;
  const deps = getDependencies(id);
  const checklist = db.prepare(
    'SELECT COUNT(*) as total, COALESCE(SUM(completed), 0) as completed FROM task_checklist WHERE task_id = ?'
  ).get(id);
  return { ...task, ...deps, labelList: getTaskLabels(id), watchers: getWatchers(id), checklist_progress: { total: checklist.total, completed: checklist.completed || 0 } };
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
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const labelFilter = req.query.label;

  let tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
           r.name as reporter_name, r.email as reporter_email,
           s.name as sprint_name, m.name as milestone_name,
           (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND deleted_at IS NULL) as subtask_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users r ON t.reporter_id = r.id
    LEFT JOIN sprints s ON t.sprint_id = s.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    WHERE t.project_id = ? AND t.deleted_at IS NULL
    ORDER BY t.position ASC, t.created_at DESC
  `).all(projectId);

  if (labelFilter) {
    const matchingIds = db.prepare(`
      SELECT DISTINCT tl.task_id
      FROM task_labels tl
      JOIN labels l ON l.id = tl.label_id
      WHERE l.name = ?
    `).all(labelFilter).map(r => r.task_id);
    const idSet = new Set(matchingIds);
    tasks = tasks.filter(t => idSet.has(t.id));
  }

  const result = tasks.map(t => ({ ...t, ...getDependencies(t.id), labelList: getTaskLabels(t.id) }));

  res.json(result);
});

router.post('/project/:projectId', requireRole('admin', 'member'), (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { title, description, status, priority, due_date, assignee_id, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, sprint_id, milestone_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  if (status != null && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (priority != null && !VALID_PRIORITY.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (!isValidDate(due_date)) return res.status(400).json({ error: 'Invalid due_date format (expected YYYY-MM-DD)' });
  if (!isValidDate(start_date)) return res.status(400).json({ error: 'Invalid start_date format (expected YYYY-MM-DD)' });

  if (sprint_id != null) {
    const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(sprint_id);
    if (!sprint) return res.status(400).json({ error: 'Sprint not found' });
    if (sprint.project_id !== Number(projectId)) return res.status(400).json({ error: 'Sprint must belong to the same project' });
  }
  if (milestone_id != null) {
    const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(milestone_id);
    if (!milestone) return res.status(400).json({ error: 'Milestone not found' });
    if (milestone.project_id !== Number(projectId)) return res.status(400).json({ error: 'Milestone must belong to the same project' });
  }

  if (parent_id != null) {
    const parent = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(parent_id);
    if (!parent) return res.status(400).json({ error: 'Parent task not found' });
    if (parent.project_id !== Number(projectId)) return res.status(400).json({ error: 'Parent task must belong to the same project' });
  }

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM tasks WHERE project_id = ? AND status = ?'
  ).get(projectId, status || 'todo');

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, sprint_id, milestone_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    recurrence_end || null,
    sprint_id || null,
    milestone_id || null
  );

  const task = getTaskWithDeps(result.lastInsertRowid);

  syncTaskLabels(task.id, labels || '');

  const taskWithLabels = getTaskWithDeps(result.lastInsertRowid);

  logActivity(req.user.id, 'task.created', 'task', taskWithLabels.id, taskWithLabels.title);

  if (assignee_id != null) {
    notifyTaskAssigned(taskWithLabels, assignee_id);
  }

  res.status(201).json(taskWithLabels);
});

router.patch('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (req.body.status !== undefined && !VALID_STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  if (req.body.priority !== undefined && !VALID_PRIORITY.includes(req.body.priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (req.body.due_date !== undefined && !isValidDate(req.body.due_date)) return res.status(400).json({ error: 'Invalid due_date format (expected YYYY-MM-DD)' });
  if (req.body.start_date !== undefined && !isValidDate(req.body.start_date)) return res.status(400).json({ error: 'Invalid start_date format (expected YYYY-MM-DD)' });

  if (req.body.parent_id !== undefined) {
    const newParentId = req.body.parent_id;
    if (newParentId != null) {
      if (Number(newParentId) === Number(id)) {
        return res.status(400).json({ error: 'A task cannot be its own parent' });
      }
      const parent = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(newParentId);
      if (!parent) return res.status(400).json({ error: 'Parent task not found' });
      if (parent.project_id !== task.project_id) return res.status(400).json({ error: 'Parent task must belong to the same project' });
      const descendants = getDescendantIds(Number(id));
      if (descendants.has(Number(newParentId))) {
        return res.status(400).json({ error: 'Cannot set a descendant as parent (cycle detected)' });
      }
    }
  }

  if (req.body.sprint_id !== undefined && req.body.sprint_id != null) {
    const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.body.sprint_id);
    if (!sprint) return res.status(400).json({ error: 'Sprint not found' });
    if (sprint.project_id !== task.project_id) return res.status(400).json({ error: 'Sprint must belong to the same project' });
  }
  if (req.body.milestone_id !== undefined && req.body.milestone_id != null) {
    const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.body.milestone_id);
    if (!milestone) return res.status(400).json({ error: 'Milestone not found' });
    if (milestone.project_id !== task.project_id) return res.status(400).json({ error: 'Milestone must belong to the same project' });
  }

  const fields = ['title', 'description', 'status', 'priority', 'due_date', 'assignee_id', 'position', 'labels', 'start_date', 'estimated_hours', 'time_spent', 'reporter_id', 'archived', 'parent_id', 'recurrence', 'recurrence_end', 'sprint_id', 'milestone_id'];
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

  if (req.body.labels !== undefined) {
    syncTaskLabels(id, req.body.labels);
  }

  const updated = getTaskWithDeps(id);

  if (req.body.status !== undefined && req.body.status !== task.status) {
    db.prepare('INSERT INTO task_status_history (task_id, status, user_id) VALUES (?, ?, ?)')
      .run(id, updated.status, req.user.id || null);
    logActivity(req.user.id, 'task.status_changed', 'task', updated.id, updated.title, { from: task.status, to: updated.status });
  }
  if (req.body.assignee_id !== undefined && Number(req.body.assignee_id || 0) !== Number(task.assignee_id || 0)) {
    logActivity(req.user.id, 'task.assigned', 'task', updated.id, updated.title);
    if (req.body.assignee_id != null) {
      notifyTaskAssigned(updated, req.body.assignee_id);
    }
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
    notifyDependencyDone(updated);
  }

  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare("UPDATE tasks SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);

  logActivity(req.user.id, 'task.deleted', 'task', id, task.title);

  res.json({ success: true });
});

router.post('/:id/reorder', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const { status, position } = req.body;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
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
    'SELECT id FROM tasks WHERE project_id = ? AND status = ? AND id != ? AND deleted_at IS NULL ORDER BY position ASC'
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
    db.prepare('INSERT INTO task_status_history (task_id, status, user_id) VALUES (?, ?, ?)')
      .run(id, status, req.user.id || null);
    logActivity(req.user.id, 'task.status_changed', 'task', updated.id, updated.title, { from: oldStatus, to: status });
    if (status === 'done' && oldStatus !== 'done') {
      createNextOccurrence(updated);
      notifyDependencyDone(updated);
    }
  }

  res.json(updated);
});

router.post('/:id/dependencies', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const { depends_on_id } = req.body;

  if (depends_on_id == null) return res.status(400).json({ error: 'depends_on_id is required' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const dep = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(depends_on_id);
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
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?').run(id, dependsOnId);

  logActivity(req.user.id, 'task.dependency_removed', 'task', id, task.title, { depends_on_id: dependsOnId });

  res.json(getTaskWithDeps(id));
});

router.delete('/:id/dependencies', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);

  logActivity(req.user.id, 'task.dependencies_cleared', 'task', id, task.title);

  res.json(getTaskWithDeps(id));
});

router.get('/:id/status-history', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const history = db.prepare(`
    SELECT h.id, h.status, h.user_id, h.changed_at, u.name as user_name
    FROM task_status_history h
    LEFT JOIN users u ON u.id = h.user_id
    WHERE h.task_id = ?
    ORDER BY h.changed_at ASC, h.id ASC
  `).all(id);
  res.json(history);
});

router.get('/:id/checklist', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
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

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
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

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
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

router.get('/:id/time-entries', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const entries = db.prepare(`
    SELECT e.*, u.name as user_name
    FROM time_entries e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.task_id = ?
    ORDER BY e.created_at DESC
  `).all(id);
  res.json(entries);
});

router.post('/:id/time-entries', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const { minutes, note, started_at, ended_at } = req.body;

  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const mins = Number(minutes);
  if (minutes == null || Number.isNaN(mins) || mins < 0) {
    return res.status(400).json({ error: 'minutes must be a non-negative number' });
  }

  const result = db.prepare(
    'INSERT INTO time_entries (task_id, user_id, started_at, ended_at, minutes, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.id || null, started_at || null, ended_at || null, mins, note || null);

  recomputeTimeSpent(id);

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

router.get('/:id/watchers', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(getWatchers(id));
});

router.post('/:id/watchers', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?, ?)').run(id, req.user.id);
  res.status(201).json(getWatchers(id));
});

router.delete('/:id/watchers', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?').run(id, req.user.id);
  res.json(getWatchers(id));
});

export default router;
