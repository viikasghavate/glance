import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { syncProjectTags, getProjectTags, getTaskLabels } from '../services/tagging.js';

const router = Router();

router.use(requireAuth);

function isValidDate(value) {
  if (value == null || value === '') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const tagFilter = req.query.tag;
  const projects = await db.prepare(
    includeArchived
      ? `SELECT p.*, u.name as owner_name, u.email as owner_email
         FROM projects p
         LEFT JOIN users u ON p.owner_id = u.id
         WHERE p.deleted_at IS NULL
         ORDER BY p.created_at DESC`
      : `SELECT p.*, u.name as owner_name, u.email as owner_email
         FROM projects p
         LEFT JOIN users u ON p.owner_id = u.id
         WHERE p.archived = 0 AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC`
  ).all();

  let filtered = projects;
  if (tagFilter) {
    const matchingIds = await db.prepare(`
      SELECT DISTINCT pt.project_id
      FROM project_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.name = ?
    `).all(tagFilter);
    const idSet = new Set(matchingIds.map(r => r.project_id));
    filtered = projects.filter(p => idSet.has(p.id));
  }

  const stmt = db.prepare(`
    SELECT project_id, status, COUNT(*) as count
    FROM tasks
    WHERE deleted_at IS NULL AND project_id IN (${filtered.map(() => '?').join(',') || '0'})
    GROUP BY project_id, status
  `);
  const counts = await stmt.all(...filtered.map(p => p.id));

  const countMap = {};
  for (const c of counts) {
    if (!countMap[c.project_id]) countMap[c.project_id] = { todo: 0, in_progress: 0, done: 0 };
    countMap[c.project_id][c.status] = c.count;
  }

  const result = [];
  for (const p of filtered) {
    result.push({
      ...p,
      archived: !!p.archived,
      tagList: await getProjectTags(p.id),
      taskCounts: countMap[p.id] || { todo: 0, in_progress: 0, done: 0 }
    });
  }

  res.json(result);
});

async function validateProgramPortfolio(program_id, portfolio_id) {
  if (program_id != null) {
    const program = await db.prepare('SELECT id FROM programs WHERE id = ? AND deleted_at IS NULL').get(program_id);
    if (!program) return 'Program not found';
  }
  if (portfolio_id != null) {
    const portfolio = await db.prepare('SELECT id FROM portfolios WHERE id = ? AND deleted_at IS NULL').get(portfolio_id);
    if (!portfolio) return 'Portfolio not found';
  }
  return null;
}

router.post('/', requireRole('admin', 'member'), async (req, res) => {
  const { name, description, color, status, start_date, due_date, owner_id, priority, progress, tags, program_id, portfolio_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  if (progress != null && (Number.isNaN(Number(progress)) || Number(progress) < 0 || Number(progress) > 100)) {
    return res.status(400).json({ error: 'progress must be between 0 and 100' });
  }
  if (!isValidDate(start_date)) return res.status(400).json({ error: 'Invalid start_date format (expected YYYY-MM-DD)' });
  if (!isValidDate(due_date)) return res.status(400).json({ error: 'Invalid due_date format (expected YYYY-MM-DD)' });

  const refError = await validateProgramPortfolio(program_id, portfolio_id);
  if (refError) return res.status(400).json({ error: refError });

  const result = await db.prepare(
    `INSERT INTO projects (name, description, color, status, start_date, due_date, owner_id, priority, progress, tags, program_id, portfolio_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    tags || '',
    program_id || null,
    portfolio_id || null
  );

  const project = await db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);
  project.archived = !!project.archived;
  project.taskCounts = { todo: 0, in_progress: 0, done: 0 };
  await syncProjectTags(project.id, tags || '');
  project.tagList = await getProjectTags(project.id);
  logActivity(req.user.id, 'project.created', 'project', project.id, project.name);
  res.status(201).json(project);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const project = await db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ? AND p.deleted_at IS NULL
  `).get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  project.archived = !!project.archived;
  project.tagList = await getProjectTags(project.id);
  res.json(project);
});

router.patch('/:id', requireRole('admin', 'member'), async (req, res) => {
  const { id } = req.params;
  const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.body.progress !== undefined && (Number.isNaN(Number(req.body.progress)) || Number(req.body.progress) < 0 || Number(req.body.progress) > 100)) {
    return res.status(400).json({ error: 'progress must be between 0 and 100' });
  }
  if (req.body.start_date !== undefined && !isValidDate(req.body.start_date)) return res.status(400).json({ error: 'Invalid start_date format (expected YYYY-MM-DD)' });
  if (req.body.due_date !== undefined && !isValidDate(req.body.due_date)) return res.status(400).json({ error: 'Invalid due_date format (expected YYYY-MM-DD)' });

  if (req.body.program_id !== undefined || req.body.portfolio_id !== undefined) {
    const refError = await validateProgramPortfolio(req.body.program_id, req.body.portfolio_id);
    if (refError) return res.status(400).json({ error: refError });
  }

  const fields = ['name', 'description', 'color', 'archived', 'status', 'start_date', 'due_date', 'owner_id', 'priority', 'progress', 'tags', 'program_id', 'portfolio_id'];
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

  await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (req.body.tags !== undefined) {
    await syncProjectTags(id, req.body.tags);
  }
  const updated = await db.prepare(`
    SELECT p.*, u.name as owner_name, u.email as owner_email
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE p.id = ? AND p.deleted_at IS NULL
  `).get(id);
  updated.archived = !!updated.archived;
  updated.tagList = await getProjectTags(id);
  logActivity(req.user.id, 'project.updated', 'project', updated.id, updated.name);
  res.json(updated);
});

function csvEscape(value) {
  if (value == null) return '';
  return '"' + String(value).replace(/"/g, '""') + '"';
}

router.get('/:id/export', async (req, res) => {
  const { id } = req.params;
  const project = await db.prepare('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = await db.prepare(`
    SELECT t.*, u.name as assignee_name,
           s.name as sprint_name, m.name as milestone_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN sprints s ON t.sprint_id = s.id
    LEFT JOIN milestones m ON t.milestone_id = m.id
    WHERE t.project_id = ? AND t.deleted_at IS NULL AND t.archived = 0
    ORDER BY t.position ASC, t.created_at DESC
  `).all(id);

  const headers = ['id', 'title', 'status', 'priority', 'assignee', 'labels', 'sprint', 'milestone', 'start_date', 'due_date', 'estimated_hours', 'time_spent', 'description'];

  const rows = [];
  for (const t of tasks) {
    rows.push([
      t.id,
      t.title,
      t.status,
      t.priority,
      t.assignee_name,
      (await getTaskLabels(t.id)).join('; '),
      t.sprint_name,
      t.milestone_name,
      t.start_date,
      t.due_date,
      t.estimated_hours,
      t.time_spent,
      t.description
    ]);
  }

  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tasks-${id}.csv"`);
  res.send(csv);
});

router.delete('/:id', requireRole('admin', 'member'), async (req, res) => {
  const { id } = req.params;
  const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const txn = db.transaction(async () => {
    await db.prepare("UPDATE projects SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    await db.prepare("UPDATE tasks SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE project_id = ? AND deleted_at IS NULL").run(id);
  });
  await txn();

  logActivity(req.user.id, 'project.deleted', 'project', id, project.name);
  res.json({ success: true });
});

export default router;
