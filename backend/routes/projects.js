import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { syncProjectTags, getProjectTags } from '../services/tagging.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const tagFilter = req.query.tag;
  const projects = db.prepare(
    includeArchived
      ? `SELECT p.*, u.name as owner_name, u.email as owner_email
         FROM projects p
         LEFT JOIN users u ON p.owner_id = u.id
         ORDER BY p.created_at DESC`
      : `SELECT p.*, u.name as owner_name, u.email as owner_email
         FROM projects p
         LEFT JOIN users u ON p.owner_id = u.id
         WHERE p.archived = 0
         ORDER BY p.created_at DESC`
  ).all();

  let filtered = projects;
  if (tagFilter) {
    const matchingIds = db.prepare(`
      SELECT DISTINCT pt.project_id
      FROM project_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.name = ?
    `).all(tagFilter).map(r => r.project_id);
    const idSet = new Set(matchingIds);
    filtered = projects.filter(p => idSet.has(p.id));
  }

  const stmt = db.prepare(`
    SELECT project_id, status, COUNT(*) as count
    FROM tasks
    WHERE project_id IN (${filtered.map(() => '?').join(',') || '0'})
    GROUP BY project_id, status
  `);
  const counts = stmt.all(...filtered.map(p => p.id));

  const countMap = {};
  for (const c of counts) {
    if (!countMap[c.project_id]) countMap[c.project_id] = { todo: 0, in_progress: 0, done: 0 };
    countMap[c.project_id][c.status] = c.count;
  }

  const result = filtered.map(p => ({
    ...p,
    archived: !!p.archived,
    tagList: getProjectTags(p.id),
    taskCounts: countMap[p.id] || { todo: 0, in_progress: 0, done: 0 }
  }));

  res.json(result);
});

router.post('/', requireRole('admin', 'member'), (req, res) => {
  const { name, description, color, status, start_date, due_date, owner_id, priority, progress, tags } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(
    `INSERT INTO projects (name, description, color, status, start_date, due_date, owner_id, priority, progress, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    description || '',
    color || '#6366f1',
    status || 'active',
    start_date || null,
    due_date || null,
    owner_id || null,
    priority || 'medium',
    progress != null ? progress : 0,
    tags || ''
  );

  const project = db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);
  project.archived = !!project.archived;
  project.taskCounts = { todo: 0, in_progress: 0, done: 0 };
  syncProjectTags(project.id, tags || '');
  project.tagList = getProjectTags(project.id);
  logActivity(req.user.id, 'project.created', 'project', project.id, project.name);
  res.status(201).json(project);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  project.archived = !!project.archived;
  project.tagList = getProjectTags(project.id);
  res.json(project);
});

router.patch('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const fields = ['name', 'description', 'color', 'archived', 'status', 'start_date', 'due_date', 'owner_id', 'priority', 'progress', 'tags'];
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
  if (req.body.tags !== undefined) {
    syncProjectTags(id, req.body.tags);
  }
  const updated = db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(id);
  updated.archived = !!updated.archived;
  updated.tagList = getProjectTags(id);
  logActivity(req.user.id, 'project.updated', 'project', updated.id, updated.name);
  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  logActivity(req.user.id, 'project.deleted', 'project', id, project.name);
  res.json({ success: true });
});

export default router;
