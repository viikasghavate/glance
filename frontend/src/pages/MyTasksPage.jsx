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

const todayStr = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const inDueWeek = (due, today) => {
  if (!due) return false;
  if (String(due) < today) return false;
  const end = new Date(today + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  const p = n => String(n).padStart(2, '0');
  const endStr = `${end.getFullYear()}-${p(end.getMonth() + 1)}-${p(end.getDate())}`;
  return String(due) <= endStr;
};

const priorityIndex = { low: 0, medium: 1, high: 2 };
const statusIndex = { todo: 0, in_progress: 1, done: 2 };

export default function MyTasksPage() {
  const { apiFetch } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [dueFilter, setDueFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [filterSprint, setFilterSprint] = useState('');
  const [filterMilestone, setFilterMilestone] = useState('');

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

  const assigneeOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      if (t.assignee_id == null) return;
      const name = t.assignee_name || String(t.assignee_id);
      const existing = map.get(t.assignee_id);
      if (!existing) {
        map.set(t.assignee_id, { id: t.assignee_id, name });
      }
    });
    return [...map.values()].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }, [tasks]);

  const distinctSprints = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => { if (t.sprint_name) set.add(t.sprint_name); });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [tasks]);

  const distinctMilestones = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => { if (t.milestone_name) set.add(t.milestone_name); });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [tasks]);

  const distinctLabels = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => {
      const fromList = (t.labelList || []).map(l => l.name);
      const fromStr = (t.labels || '').split(',').map(l => l.trim()).filter(Boolean);
      [...fromList, ...fromStr].forEach(l => {
        const v = l.trim();
        if (v) set.add(v);
      });
    });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [tasks]);

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tasks/mine/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        alert('Export failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-tasks.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed.');
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = tasks;

    if (filter === 'overdue') {
      result = result.filter(t => isOverdue(t.due_date, t.status, today));
    } else if (filter) {
      result = result.filter(t => t.status === filter);
    }

    if (dueFilter === 'overdue') {
      result = result.filter(t => isOverdue(t.due_date, t.status, today));
    } else if (dueFilter === 'today') {
      result = result.filter(t => t.due_date && String(t.due_date) === todayStr());
    } else if (dueFilter === 'week') {
      result = result.filter(t => inDueWeek(t.due_date, todayStr()));
    }

    if (query) {
      result = result.filter(t => {
        const labelNames = (t.labelList || []).map(l => l.name).join(' ');
        const haystack = `${t.title || ''} ${t.description || ''} ${t.project_name || ''} ${labelNames}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    if (priorityFilter) {
      result = result.filter(t => t.priority === priorityFilter);
    }

    if (assigneeFilter) {
      result = result.filter(t => String(t.assignee_id) === String(assigneeFilter));
    }

    if (labelFilter) {
      const target = labelFilter.toLowerCase();
      result = result.filter(t => {
        const fromList = (t.labelList || []).map(l => l.name);
        const fromStr = (t.labels || '').split(',').map(l => l.trim()).filter(Boolean);
        return [...fromList, ...fromStr].map(l => l.toLowerCase()).includes(target);
      });
    }

    if (filterSprint) {
      result = result.filter(t => t.sprint_name === filterSprint);
    }

    if (filterMilestone) {
      result = result.filter(t => t.milestone_name === filterMilestone);
    }

    if (sortBy) {
      const sorted = [...result].sort((a, b) => {
        if (sortBy === 'priority') {
          const ai = priorityIndex[a.priority] ?? 0;
          const bi = priorityIndex[b.priority] ?? 0;
          const cmp = ai - bi;
          return cmp !== 0 ? (sortDir === 'desc' ? -cmp : cmp) : 0;
        }
        if (sortBy === 'due_date') {
          const ad = a.due_date ? String(a.due_date) : null;
          const bd = b.due_date ? String(b.due_date) : null;
          if (ad === null && bd === null) return 0;
          if (ad === null) return 1;
          if (bd === null) return -1;
          const cmp = ad < bd ? -1 : ad > bd ? 1 : 0;
          return sortDir === 'desc' ? -cmp : cmp;
        }
        if (sortBy === 'status') {
          const ai = statusIndex[a.status] ?? 0;
          const bi = statusIndex[b.status] ?? 0;
          const cmp = ai - bi;
          return cmp !== 0 ? (sortDir === 'desc' ? -cmp : cmp) : 0;
        }
        if (sortBy === 'title') {
          const av = (a.title || '').toLowerCase();
          const bv = (b.title || '').toLowerCase();
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return sortDir === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
      result = sorted;
    }

    return result;
  }, [tasks, filter, search, sortBy, sortDir, dueFilter, priorityFilter, assigneeFilter, labelFilter, filterSprint, filterMilestone, today]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="my-tasks">
      <div className="page-header">
        <h1>My Tasks</h1>
        <button className="btn-ghost" onClick={handleExportCsv}>
          Export CSV
        </button>
      </div>

      <div className="my-tasks-toolbar">
        <input
          className="my-tasks-search"
          type="text"
          placeholder="Search your tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="">Sort by: None</option>
          <option value="priority">Sort by: Priority</option>
          <option value="due_date">Sort by: Due Date</option>
          <option value="status">Sort by: Status</option>
          <option value="title">Sort by: Title</option>
        </select>
        <button
          type="button"
          className="sort-toggle"
          disabled={!sortBy}
          onClick={() => setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'))}
          title={sortDir === 'asc' ? 'Sort: Ascending' : 'Sort: Descending'}
        >
          {sortDir === 'asc' ? '▲' : '▼'}
        </button>
        <select value={dueFilter} onChange={e => setDueFilter(e.target.value)}>
          <option value="">All Due</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due Today</option>
          <option value="week">Due This Week</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
          <option value="">All Assignees</option>
          {assigneeOptions.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select value={labelFilter} onChange={e => setLabelFilter(e.target.value)}>
          <option value="">All Labels</option>
          {distinctLabels.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select value={filterSprint} onChange={e => setFilterSprint(e.target.value)}>
          <option value="">All Sprints</option>
          {distinctSprints.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterMilestone} onChange={e => setFilterMilestone(e.target.value)}>
          <option value="">All Milestones</option>
          {distinctMilestones.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
