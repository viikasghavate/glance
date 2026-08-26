import db from '../db.js';

const VALID_STATUS = ['todo', 'in_progress', 'done'];

function truncate(value, max = 12000) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (s.length <= max) return s;
  return s.slice(0, max) + '…[truncated]';
}

const tools = [
  {
    name: 'list_projects',
    description: 'List all active (non-archived, non-deleted) projects with their task counts.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: () => {
      const projects = db.prepare(`
        SELECT p.id, p.name, p.description, p.status, p.priority, p.progress,
               p.start_date, p.due_date, u.name as owner_name
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.archived = 0 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
      `).all();
      const counts = db.prepare(`
        SELECT project_id, status, COUNT(*) as count
        FROM tasks
        WHERE deleted_at IS NULL AND archived = 0
        GROUP BY project_id, status
      `).all();
      const countMap = {};
      for (const c of counts) {
        if (!countMap[c.project_id]) countMap[c.project_id] = { todo: 0, in_progress: 0, done: 0 };
        countMap[c.project_id][c.status] = c.count;
      }
      return projects.map(p => ({ ...p, taskCounts: countMap[p.id] || { todo: 0, in_progress: 0, done: 0 } }));
    }
  },
  {
    name: 'get_project',
    description: 'Get a single project by id, including its task counts.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Project id' }
      },
      required: ['id']
    },
    handler: (user, args) => {
      const project = db.prepare(`
        SELECT p.*, u.name as owner_name
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.id = ? AND p.deleted_at IS NULL
      `).get(args.id);
      if (!project) return { error: 'Project not found' };
      const counts = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM tasks
        WHERE project_id = ? AND deleted_at IS NULL AND archived = 0
        GROUP BY status
      `).all(args.id);
      const taskCounts = { todo: 0, in_progress: 0, done: 0 };
      for (const c of counts) taskCounts[c.status] = c.count;
      return { ...project, taskCounts };
    }
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by project_id, status, or assignee_id.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'integer', description: 'Filter by project id' },
        status: { type: 'string', enum: VALID_STATUS, description: 'Filter by status' },
        assignee_id: { type: 'integer', description: 'Filter by assignee user id' }
      },
      required: []
    },
    handler: (user, args) => {
      const conditions = ['t.deleted_at IS NULL', 't.archived = 0'];
      const values = [];
      if (args.project_id != null) { conditions.push('t.project_id = ?'); values.push(args.project_id); }
      if (args.status != null) { conditions.push('t.status = ?'); values.push(args.status); }
      if (args.assignee_id != null) { conditions.push('t.assignee_id = ?'); values.push(args.assignee_id); }
      return db.prepare(`
        SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
               p.name as project_name, u.name as assignee_name
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.due_date ASC, t.id ASC
      `).all(...values);
    }
  },
  {
    name: 'get_task',
    description: 'Get a single task by id, including assignee, project, sprint, milestone, dependencies, checklist progress, and labels.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Task id' }
      },
      required: ['id']
    },
    handler: (user, args) => {
      const task = db.prepare(`
        SELECT t.*, u.name as assignee_name, p.name as project_name,
               s.name as sprint_name, m.name as milestone_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN sprints s ON s.id = t.sprint_id
        LEFT JOIN milestones m ON m.id = t.milestone_id
        WHERE t.id = ? AND t.deleted_at IS NULL
      `).get(args.id);
      if (!task) return { error: 'Task not found' };
      const checklist = db.prepare(
        'SELECT COUNT(*) as total, COALESCE(SUM(completed), 0) as completed FROM task_checklist WHERE task_id = ?'
      ).get(args.id);
      const labels = db.prepare(`
        SELECT l.name FROM labels l
        JOIN task_labels tl ON tl.label_id = l.id
        WHERE tl.task_id = ?
        ORDER BY l.name ASC
      `).all(args.id).map(r => r.name);
      return { ...task, labels, checklist_progress: { total: checklist.total, completed: checklist.completed || 0 } };
    }
  },
  {
    name: 'list_sprints',
    description: 'List sprints for a project.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'integer', description: 'Project id' }
      },
      required: ['project_id']
    },
    handler: (user, args) => db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.deleted_at IS NULL) as task_count
      FROM sprints s
      WHERE s.project_id = ?
      ORDER BY s.start_date ASC, s.id ASC
    `).all(args.project_id)
  },
  {
    name: 'list_milestones',
    description: 'List milestones for a project.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'integer', description: 'Project id' }
      },
      required: ['project_id']
    },
    handler: (user, args) => db.prepare(`
      SELECT m.*, (SELECT COUNT(*) FROM tasks t WHERE t.milestone_id = m.id AND t.deleted_at IS NULL) as task_count
      FROM milestones m
      WHERE m.project_id = ?
      ORDER BY m.due_date ASC, m.id ASC
    `).all(args.project_id)
  },
  {
    name: 'search',
    description: 'Search projects, tasks, and comments by a text query.',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query (min 2 chars)' }
      },
      required: ['q']
    },
    handler: (user, args) => {
      const q = String(args.q || '').trim();
      if (q.length < 2) return { projects: [], tasks: [], comments: [] };
      const like = `%${q}%`;
      const projects = db.prepare(`
        SELECT id, name, color FROM projects
        WHERE deleted_at IS NULL AND (name LIKE ? OR description LIKE ?)
        ORDER BY name ASC LIMIT 10
      `).all(like, like);
      const tasks = db.prepare(`
        SELECT t.id, t.title, t.project_id, p.name as project_name, t.status
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.deleted_at IS NULL AND (t.title LIKE ? OR t.description LIKE ? OR t.labels LIKE ?)
        ORDER BY t.title ASC LIMIT 10
      `).all(like, like, like);
      const comments = db.prepare(`
        SELECT c.id, c.body, c.task_id, t.project_id, t.title as task_title, u.name as user_name
        FROM comments c
        JOIN tasks t ON t.id = c.task_id
        JOIN users u ON u.id = c.user_id
        WHERE t.deleted_at IS NULL AND c.body LIKE ?
        ORDER BY c.created_at DESC LIMIT 10
      `).all(like);
      return { projects, tasks, comments };
    }
  },
  {
    name: 'analytics',
    description: 'Get workspace analytics: project/task counts, overdue tasks, project progress, and workload by member.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    handler: () => {
      const projects = db.prepare('SELECT COUNT(*) as count FROM projects WHERE archived = 0 AND deleted_at IS NULL').get().count;
      const tasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL').get().count;
      const tasksDone = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'done'").get().count;
      const tasksInProgress = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'in_progress'").get().count;
      const tasksTodo = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'todo'").get().count;
      const overdueTasks = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status != 'done' AND due_date IS NOT NULL AND due_date < date('now')"
      ).get().count;
      const overdueList = db.prepare(`
        SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE t.archived = 0 AND t.deleted_at IS NULL AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now')
        ORDER BY t.due_date ASC
      `).all();
      const projectProgress = db.prepare(`
        SELECT p.id as project_id, p.name,
               COUNT(t.id) as tasks,
               SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id AND t.archived = 0 AND t.deleted_at IS NULL
        WHERE p.archived = 0 AND p.deleted_at IS NULL
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `).all().map(p => ({
        project_id: p.project_id,
        name: p.name,
        tasks: p.tasks,
        done: p.done || 0,
        progress: p.tasks > 0 ? Math.round((p.done / p.tasks) * 100) : 0
      }));
      return {
        summary: { projects, tasks, tasksDone, tasksInProgress, tasksTodo, overdueTasks },
        overdueTasks: overdueList,
        projectProgress
      };
    }
  },
  {
    name: 'get_activity',
    description: 'Get recent activity log entries.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max number of entries (default 20)' }
      },
      required: []
    },
    handler: (user, args) => {
      const limit = Math.min(parseInt(args.limit, 10) || 20, 100);
      return db.prepare(`
        SELECT a.*, u.name as user_name
        FROM activity_log a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?
      `).all(limit);
    }
  }
];

const toolMap = new Map(tools.map(t => [t.name, t]));

export function getToolDefinitions() {
  return tools.map(({ name, description, parameters }) => ({ type: 'function', function: { name, description, parameters } }));
}

export function executeTool(name, user, args) {
  const tool = toolMap.get(name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    const result = tool.handler(user, args || {});
    return truncate(result);
  } catch (err) {
    return { error: err.message };
  }
}
