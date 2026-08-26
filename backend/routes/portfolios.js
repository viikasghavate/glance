import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.use(requireAuth);

function getPortfolio(id) {
  return db.prepare('SELECT * FROM portfolios WHERE id = ? AND deleted_at IS NULL').get(id);
}

router.get('/', (req, res) => {
  const portfolios = db.prepare(`
    SELECT * FROM portfolios
    WHERE deleted_at IS NULL AND archived = 0
    ORDER BY name ASC
  `).all();

  const programs = db.prepare(`
    SELECT * FROM programs
    WHERE deleted_at IS NULL AND archived = 0
    ORDER BY name ASC
  `).all();

  const directProjects = db.prepare(`
    SELECT id, name, color, portfolio_id, program_id
    FROM projects
    WHERE deleted_at IS NULL AND archived = 0 AND portfolio_id IS NOT NULL
    ORDER BY name ASC
  `).all();

  const programProjects = db.prepare(`
    SELECT id, name, color, portfolio_id, program_id
    FROM projects
    WHERE deleted_at IS NULL AND archived = 0 AND program_id IS NOT NULL
    ORDER BY name ASC
  `).all();

  const result = portfolios.map(p => {
    const portfolioPrograms = programs.filter(pr => pr.portfolio_id === p.id);
    const portfolioDirectProjects = directProjects.filter(pr => pr.portfolio_id === p.id);
    const programIds = new Set(portfolioPrograms.map(pr => pr.id));
    const viaProgramProjects = programProjects.filter(pr => programIds.has(pr.program_id));
    const projectCount = portfolioDirectProjects.length + viaProgramProjects.length;

    return {
      ...p,
      archived: !!p.archived,
      programs: portfolioPrograms.map(pr => ({
        ...pr,
        archived: !!pr.archived,
        projectCount: programProjects.filter(pp => pp.program_id === pr.id).length
      })),
      projects: portfolioDirectProjects,
      projectCount
    };
  });

  res.json(result);
});

router.post('/', requireRole('admin', 'member'), (req, res) => {
  const { name, description, color, owner_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(
    'INSERT INTO portfolios (name, description, color, owner_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', color || '#6366f1', owner_id || null);

  const portfolio = getPortfolio(result.lastInsertRowid);
  logActivity(req.user.id, 'portfolio.created', 'portfolio', portfolio.id, portfolio.name);
  res.status(201).json(portfolio);
});

router.patch('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const portfolio = getPortfolio(id);
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

  const fields = ['name', 'description', 'color', 'archived', 'owner_id'];
  const updates = [];
  const values = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(f === 'archived' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }

  if (updates.length === 0) return res.json(portfolio);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE portfolios SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = getPortfolio(id);
  logActivity(req.user.id, 'portfolio.updated', 'portfolio', updated.id, updated.name);
  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const portfolio = getPortfolio(id);
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

  const txn = db.transaction(() => {
    db.prepare("UPDATE portfolios SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    db.prepare("UPDATE programs SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE portfolio_id = ? AND deleted_at IS NULL").run(id);
    db.prepare("UPDATE projects SET portfolio_id = NULL, updated_at = datetime('now') WHERE portfolio_id = ? AND deleted_at IS NULL").run(id);
  });
  txn();

  logActivity(req.user.id, 'portfolio.deleted', 'portfolio', id, portfolio.name);
  res.json({ success: true });
});

export default router;
