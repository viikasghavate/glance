import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from '../db.js';
import { uploadsDir } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.task_id = ?
    ORDER BY a.created_at DESC
  `).all(taskId);
  res.json(attachments);
});

router.post('/task/:taskId', requireRole('admin', 'member'), upload.single('file'), (req, res) => {
  const { taskId } = req.params;
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(taskId);
  if (!task) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  const result = db.prepare(
    'INSERT INTO attachments (task_id, filename, stored_path, size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    taskId,
    req.file.originalname,
    req.file.filename,
    req.file.size || 0,
    req.file.mimetype || null,
    req.user.id || null
  );

  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(attachment);
});

router.get('/:id/download', (req, res) => {
  const { id } = req.params;
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = path.join(uploadsDir, attachment.stored_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.download(filePath, attachment.filename);
});

router.delete('/:id', requireRole('admin', 'member'), (req, res) => {
  const { id } = req.params;
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  db.prepare('DELETE FROM attachments WHERE id = ?').run(id);

  const filePath = path.join(uploadsDir, attachment.stored_path);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (err) { console.error('Failed to delete file:', err.message); }
  }

  res.json({ success: true });
});

export default router;
