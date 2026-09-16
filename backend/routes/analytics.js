import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const projects = (await db.prepare('SELECT COUNT(*) as count FROM projects WHERE archived = 0 AND deleted_at IS NULL').get()).count;
  const tasks = (await db.prepare('SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL').get()).count;
  const tasksDone = (await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'done'").get()).count;
  const tasksInProgress = (await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'in_progress'").get()).count;
  const tasksTodo = (await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'todo'").get()).count;
  const overdueTasks = (await db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status != 'done' AND due_date IS NOT NULL AND due_date < date('now')"
  ).get()).count;
  const members = (await db.prepare('SELECT COUNT(*) as count FROM users').get()).count;

  const tasksByStatus = await db.prepare(
    "SELECT status, COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL GROUP BY status ORDER BY count DESC"
  ).all();

  const tasksByPriority = await db.prepare(
    "SELECT priority, COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL GROUP BY priority ORDER BY count DESC"
  ).all();

  const workloadByMember = await db.prepare(`
    SELECT u.id as user_id, u.name,
           COUNT(t.id) as tasksAssigned,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as tasksDone
    FROM users u
    LEFT JOIN tasks t ON t.assignee_id = u.id AND t.archived = 0 AND t.deleted_at IS NULL
    GROUP BY u.id
    ORDER BY tasksAssigned DESC
  `).all();

  const projectProgressRows = await db.prepare(`
    SELECT p.id as project_id, p.name,
           COUNT(t.id) as tasks,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.archived = 0 AND t.deleted_at IS NULL
    WHERE p.archived = 0 AND p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  const projectProgress = projectProgressRows.map(p => ({
    project_id: p.project_id,
    name: p.name,
    tasks: p.tasks,
    done: p.done || 0,
    progress: p.tasks > 0 ? Math.round((p.done / p.tasks) * 100) : 0
  }));

  const overdueList = await db.prepare(`
    SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.archived = 0 AND t.deleted_at IS NULL AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now')
    ORDER BY t.due_date ASC
  `).all();

  const dueSoonList = await db.prepare(`
    SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.archived = 0 AND t.deleted_at IS NULL
      AND t.status != 'done'
      AND t.due_date IS NOT NULL
      AND t.due_date >= date('now')
      AND t.due_date <= date('now', '+6 days')
    ORDER BY t.due_date ASC
  `).all();

  const recentActivity = await db.prepare(`
    SELECT t.id, t.title, p.name as project_name, t.status, t.updated_at
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.archived = 0 AND t.deleted_at IS NULL
    ORDER BY t.updated_at DESC
    LIMIT 8
  `).all();

  const statusTrend = await db.prepare(`
    SELECT date(changed_at) as day, status, COUNT(*) as count
    FROM task_status_history
    WHERE changed_at >= date('now', '-30 days')
    GROUP BY date(changed_at), status
    ORDER BY day ASC
  `).all();

  const roundHours = minutes => Math.round((minutes / 60) * 10) / 10;

  const totalMinutes = (await db.prepare(`
    SELECT COALESCE(SUM(e.minutes), 0) as total
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL
  `).get()).total;

  const weekMinutes = (await db.prepare(`
    SELECT COALESCE(SUM(e.minutes), 0) as total
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL AND e.created_at >= datetime('now', '-7 days')
  `).get()).total;

  const monthMinutes = (await db.prepare(`
    SELECT COALESCE(SUM(e.minutes), 0) as total
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL AND e.created_at >= datetime('now', '-30 days')
  `).get()).total;

  const timeByProjectRows = await db.prepare(`
    SELECT p.id as project_id, p.name, COALESCE(SUM(e.minutes), 0) as minutes
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY minutes DESC
    LIMIT 6
  `).all();
  const timeByProject = timeByProjectRows.map(r => ({
    project_id: r.project_id,
    name: r.name,
    hours: roundHours(r.minutes)
  }));

  const timeByUserRows = await db.prepare(`
    SELECT u.id as user_id, u.name, COALESCE(SUM(e.minutes), 0) as minutes
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE t.deleted_at IS NULL
    GROUP BY u.id
    ORDER BY minutes DESC
    LIMIT 6
  `).all();
  const timeByUser = timeByUserRows.map(r => ({
    user_id: r.user_id,
    name: r.name,
    hours: roundHours(r.minutes)
  }));

  res.json({
    time: {
      totalHoursLogged: roundHours(totalMinutes),
      hoursThisWeek: roundHours(weekMinutes),
      hoursThisMonth: roundHours(monthMinutes),
      timeByProject,
      timeByUser
    },
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
    dueSoonTasks: dueSoonList,
    recentActivity,
    statusTrend
  });
});

export default router;
