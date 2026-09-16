import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const tags = await db.prepare(`
    SELECT t.id, t.name, COUNT(pt.project_id) as project_count
    FROM tags t
    LEFT JOIN project_tags pt ON pt.tag_id = t.id
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all();
  res.json(tags);
});

export default router;
