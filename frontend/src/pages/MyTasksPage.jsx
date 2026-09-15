import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isOverdue } from '../components/overdue';
import './MyTasksPage.css';

const statusMeta = {
  todo: { label: 'To Do', color: 'var(--cyan)' },
  in_progress: { label: 'In Progress', color: 'var(--warning)' },
  done: { label: 'Done', color: 'var(--success)' }
};

const statusLabel = (s) => (statusMeta[s] ? statusMeta[s].label : s);

export default function MyTasksPage() {
  const { apiFetch } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    apiFetch('/tasks/mine')
      .then(setTasks)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const today = new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => {
    const c = { todo: 0, in_progress: 0, done: 0, overdue: 0 };
    tasks.forEach(t => {
      if (t.status === 'todo') c.todo++;
      else if (t.status === 'in_progress') c.in_progress++;
      else if (t.status === 'done') c.done++;
      if (isOverdue(t.due_date, t.status, today)) c.overdue++;
    });
    return c;
  }, [tasks, today]);

  const filtered = useMemo(() => {
    if (!filter) return tasks;
    if (filter === 'overdue') return tasks.filter(t => isOverdue(t.due_date, t.status, today));
    return tasks.filter(t => t.status === filter);
  }, [tasks, filter, today]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="my-tasks">
      <div className="page-header">
        <h1>My Tasks</h1>
      </div>

      <div className="my-tasks-chips">
        <button
          className={`chip ${filter === '' ? 'active' : ''}`}
          onClick={() => setFilter('')}
        >
          All <span className="chip-count">{tasks.length}</span>
        </button>
        <button
          className={`chip chip-todo ${filter === 'todo' ? 'active' : ''}`}
          onClick={() => setFilter('todo')}
        >
          To Do <span className="chip-count">{counts.todo}</span>
        </button>
        <button
          className={`chip chip-progress ${filter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setFilter('in_progress')}
        >
          In Progress <span className="chip-count">{counts.in_progress}</span>
        </button>
        <button
          className={`chip chip-done ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter('done')}
        >
          Done <span className="chip-count">{counts.done}</span>
        </button>
        <button
          className={`chip chip-overdue ${filter === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          Overdue <span className="chip-count">{counts.overdue}</span>
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div>You have no assigned tasks yet.</div>
          <div className="empty-hint">Tasks assigned to you will appear here.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No tasks match your filter.</div>
      ) : (
        <div className="panel">
          <div className="my-tasks-list">
            {filtered.map(task => (
              <Link
                key={task.id}
                to={`/project/${task.project_id}?task=${task.id}`}
                className={`task-row ${isOverdue(task.due_date, task.status, today) ? 'overdue' : ''}`}
              >
                <div className="task-row-title">{task.title}</div>
                <div className="task-row-meta">
                  {task.project_name && <span className="task-row-project">{task.project_name}</span>}
                  <span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  {task.assignee_name && <span className="task-row-assignee">{task.assignee_name}</span>}
                  {task.sprint_name && <span className="badge badge-todo">{task.sprint_name}</span>}
                  {task.milestone_name && <span className="badge badge-in_progress">{task.milestone_name}</span>}
                  {task.due_date && (
                    <span className={`task-row-due ${isOverdue(task.due_date, task.status, today) ? 'overdue' : ''}`}>
                      {task.due_date}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
