import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../services/activity.js';
import { runAssistant } from '../ai/index.js';
import db from '../db.js';

const router = Router();

router.use(requireAuth);

function getSessionForUser(sessionId, userId) {
  return db.prepare('SELECT * FROM ai_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
}

function loadMessages(sessionId) {
  return db.prepare(
    'SELECT role, content FROM ai_messages WHERE session_id = ? ORDER BY id ASC'
  ).all(sessionId);
}

router.post('/chat', async (req, res) => {
  const { message, session_id } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const text = String(message).trim();

  try {
    let session = null;
    if (session_id != null) {
      session = getSessionForUser(session_id, req.user.id);
    }

    if (!session) {
      const title = text.slice(0, 40);
      const result = db.prepare(
        'INSERT INTO ai_sessions (user_id, title) VALUES (?, ?)'
      ).run(req.user.id, title);
      session = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(result.lastInsertRowid);
    }

    const prior = loadMessages(session.id);

    db.prepare('INSERT INTO ai_messages (session_id, role, content) VALUES (?, ?, ?)')
      .run(session.id, 'user', text);

    const history = [...prior, { role: 'user', content: text }];
    const reply = await runAssistant(req.user, history);

    db.prepare('INSERT INTO ai_messages (session_id, role, content) VALUES (?, ?, ?)')
      .run(session.id, 'assistant', reply);

    db.prepare("UPDATE ai_sessions SET updated_at = datetime('now') WHERE id = ?").run(session.id);

    logActivity(req.user.id, 'ai.chat', 'ai', session.id, session.title, { prompt: text, reply });

    res.json({ reply, session_id: session.id });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(502).json({ error: 'AI service unavailable' });
  }
});

router.get('/sessions', (req, res) => {
  const sessions = db.prepare(
    'SELECT id, title, updated_at FROM ai_sessions WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 30'
  ).all(req.user.id);
  res.json({ sessions });
});

router.get('/sessions/:id/messages', (req, res) => {
  const session = getSessionForUser(req.params.id, req.user.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const messages = loadMessages(session.id);
  res.json({ session_id: session.id, title: session.title, messages });
});

export default router;
