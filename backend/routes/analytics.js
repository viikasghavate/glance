import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const projects = db.prepare('SELECT COUNT(*) as count FROM projects WHERE archived = 0').get().count;
  const tasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE archived = 0').get().count;
  const tasksDone = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND status = 'done'").get().count;
  const tasksInProgress = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND status = 'in_progress'").get().count;
  const tasksTodo = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND status = 'todo'").get().count;
  const overdueTasks = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND status != 'done' AND due_date IS NOT NULL AND due_date < date('now')"
  ).get().count;
  const members = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  const tasksByStatus = db.prepare(
    "SELECT status, COUNT(*) as count FROM tasks WHERE archived = 0 GROUP BY status ORDER BY count DESC"
  ).all();

  const tasksByPriority = db.prepare(
    "SELECT priority, COUNT(*) as count FROM tasks WHERE archived = 0 GROUP BY priority ORDER BY count DESC"
  ).all();

  const workloadByMember = db.prepare(`
    SELECT u.id as user_id, u.name,
           COUNT(t.id) as tasksAssigned,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as tasksDone
    FROM users u
    LEFT JOIN tasks t ON t.assignee_id = u.id AND t.archived = 0
    GROUP BY u.id
    ORDER BY tasksAssigned DESC
  `).all();

  const projectProgress = db.prepare(`
    SELECT p.id as project_id, p.name,
           COUNT(t.id) as tasks,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.archived = 0
    WHERE p.archived = 0
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all().map(p => ({
    project_id: p.project_id,
    name: p.name,
    tasks: p.tasks,
    done: p.done || 0,
    progress: p.tasks > 0 ? Math.round((p.done / p.tasks) * 100) : 0
  }));

  const overdueList = db.prepare(`
    SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.archived = 0 AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now')
    ORDER BY t.due_date ASC
  `).all();

  const recentActivity = db.prepare(`
    SELECT t.id, t.title, p.name as project_name, t.status, t.updated_at
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.archived = 0
    ORDER BY t.updated_at DESC
    LIMIT 8
  `).all();

  const statusTrend = db.prepare(`
    SELECT date(changed_at) as day, status, COUNT(*) as count
    FROM task_status_history
    WHERE changed_at >= date('now', '-30 days')
    GROUP BY date(changed_at), status
    ORDER BY day ASC
  `).all();

  res.json({
    summary: {
      projects,
      tasks,
      tasksDone,
      tasksInProgress,
      tasksTodo,
      overdueTasks,
      members
    },
    tasksByStatus,
    tasksByPriority,
    workloadByMember,
    projectProgress,
    overdueTasks: overdueList,
    recentActivity,
    statusTrend
  });
});

export default router;
