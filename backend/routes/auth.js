import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { requireAuth, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const role = userCount.count === 0 ? 'admin' : 'member';

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, hash, name, role);
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at, last_login_at: user.last_login_at }
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;
