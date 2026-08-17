import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const labels = db.prepare(`
    SELECT l.id, l.name, COUNT(tl.task_id) as task_count
    FROM labels l
    LEFT JOIN task_labels tl ON tl.label_id = l.id
    GROUP BY l.id
    ORDER BY l.name ASC
  `).all();
  res.json(labels);
});

export default router;
