import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { seed } from './seed.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import commentRoutes from './routes/comments.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import activityRoutes from './routes/activity.js';
import searchRoutes from './routes/search.js';
import tagRoutes from './routes/tags.js';
import labelRoutes from './routes/labels.js';
import timeEntryRoutes from './routes/time_entries.js';
import attachmentRoutes from './routes/attachments.js';
import notificationRoutes from './routes/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json());

seed();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/time', timeEntryRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/notifications', notificationRoutes);

const frontendDist = (() => {
  const containerPath = path.join(__dirname, 'frontend', 'dist');
  if (fs.existsSync(containerPath)) return containerPath;
  return path.join(__dirname, '..', 'frontend', 'dist');
})();
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Glance server running on port ${PORT}`);
});
