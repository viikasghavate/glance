import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { runAssistant } from '../ai/index.js';

const router = Router();

router.use(requireAuth);

router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const reply = await runAssistant(req.user, String(message).trim());
    logActivity(req.user.id, 'ai.chat', 'ai', null, null, { prompt: String(message).trim(), reply });
    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(502).json({ error: 'AI service unavailable' });
  }
});

export default router;
