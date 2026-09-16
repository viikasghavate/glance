import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

async function getProgram(id) {
  return db.prepare(`
    SELECT pr.*, (SELECT COUNT(*) FROM projects p WHERE p.program_id = pr.id AND p.deleted_at IS NULL AND p.archived = 0) as project_count
    FROM programs pr
    WHERE pr.id = ? AND pr.deleted_at IS NULL
  `).get(id);
}

router.get('/', async (req, res) => {
  const programs = await db.prepare(`
    SELECT pr.*, (SELECT COUNT(*) FROM projects p WHERE p.program_id = pr.id AND p.deleted_at IS NULL AND p.archived = 0) as project_count
    FROM programs pr
    WHERE pr.deleted_at IS NULL AND pr.archived = 0
    ORDER BY pr.name ASC
  `).all();

  res.json(programs.map(p => ({ ...p, archived: !!p.archived })));
});

router.post('/', requireRole('admin', 'member'), async (req, res) => {
  const { name, description, color, portfolio_id, owner_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  if (portfolio_id != null) {
    const portfolio = await db.prepare('SELECT id FROM portfolios WHERE id = ? AND deleted_at IS NULL').get(portfolio_id);
    if (!portfolio) return res.status(400).json({ error: 'Portfolio not found' });
  }

  const result = await db.prepare(
    'INSERT INTO programs (name, description, color, portfolio_id, owner_id) VALUES (?, ?, ?, ?, ?)'
  ).run(name, description || '', color || '#6366f1', portfolio_id || null, owner_id || null);

  const program = await getProgram(result.lastInsertRowid);
  logActivity(req.user.id, 'program.created', 'program', program.id, program.name);
  res.status(201).json(program);
});

router.patch('/:id', requireRole('admin', 'member'), async (req, res) => {
  const { id } = req.params;
  const program = await db.prepare('SELECT * FROM programs WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!program) return res.status(404).json({ error: 'Program not found' });

  if (req.body.portfolio_id !== undefined && req.body.portfolio_id != null) {
    const portfolio = await db.prepare('SELECT id FROM portfolios WHERE id = ? AND deleted_at IS NULL').get(req.body.portfolio_id);
    if (!portfolio) return res.status(400).json({ error: 'Portfolio not found' });
  }

  const fields = ['name', 'description', 'color', 'archived', 'portfolio_id', 'owner_id'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'archived' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(await getProgram(id));

  updates.push("updated_at = datetime('now')");
  values.push(id);

  await db.prepare(`UPDATE programs SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = await getProgram(id);
  logActivity(req.user.id, 'program.updated', 'program', updated.id, updated.name);
  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'member'), async (req, res) => {
  const { id } = req.params;
  const program = await db.prepare('SELECT * FROM programs WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!program) return res.status(404).json({ error: 'Program not found' });

  const txn = db.transaction(async () => {
    await db.prepare("UPDATE programs SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    await db.prepare("UPDATE projects SET program_id = NULL, updated_at = datetime('now') WHERE program_id = ? AND deleted_at IS NULL").run(id);
  });
  await txn();

  logActivity(req.user.id, 'program.deleted', 'program', id, program.name);
  res.json({ success: true });
});

export default router;
