import { useState, useMemo } from 'react';
import './TaskList.css';
import { isOverdue, dueInfo } from './overdue';

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

export default function TaskList({ tasks, users, onTaskClick, onStatusChange, onReorder, readOnly }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [filterSprint, setFilterSprint] = useState('');
  const [filterMilestone, setFilterMilestone] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [dragOverId, setDragOverId] = useState(null);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const priorityIndex = { low: 0, medium: 1, high: 2 };
  const statusIndex = { todo: 0, in_progress: 1, done: 2 };

  const sortCompare = (a, b) => {
    if (sortBy === '') return 0;
    if (sortBy === 'priority') {
      const ai = priorityIndex[a.priority] ?? 0;
      const bi = priorityIndex[b.priority] ?? 0;
      return ai - bi;
    }
    if (sortBy === 'due_date') {
      const ad = a.due_date ? String(a.due_date) : null;
      const bd = b.due_date ? String(b.due_date) : null;
      if (ad === null && bd === null) return 0;
      if (ad === null) return 1;
      if (bd === null) return -1;
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    }
    if (sortBy === 'status') {
      const ai = statusIndex[a.status] ?? 0;
      const bi = statusIndex[b.status] ?? 0;
      return ai - bi;
    }
    if (sortBy === 'assignee') {
      const av = (a.assignee_name || '').toLowerCase();
      const bv = (b.assignee_name || '').toLowerCase();
      return av < bv ? -1 : av > bv ? 1 : 0;
    }
    if (sortBy === 'title') {
      const av = (a.title || '').toLowerCase();
      const bv = (b.title || '').toLowerCase();
      return av < bv ? -1 : av > bv ? 1 : 0;
    }
    return 0;
  };

  const sortedCompare = (a, b) => {
    if (sortBy === 'due_date') {
      const ad = a.due_date ? String(a.due_date) : null;
      const bd = b.due_date ? String(b.due_date) : null;
      if (ad === null && bd === null) return 0;
      if (ad === null) return 1;
      if (bd === null) return -1;
    }
    const result = sortCompare(a, b);
    if (result !== 0) return sortDir === 'desc' ? -result : result;
    return 0;
  };

  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const collapseAll = () => {
    const parentIds = filtered.filter(t => t.hasChildren).map(t => t.id);
    setCollapsed(prev => {
      const next = { ...prev };
      parentIds.forEach(id => { next[id] = true; });
      return next;
    });
  };

  const expandAll = () => {
    setCollapsed({});
  };

  const tree = useMemo(() => {
    const taskMap = {};
    const roots = [];
    tasks.forEach(t => { taskMap[t.id] = { ...t, children: [] }; });
    tasks.forEach(t => {
      if (t.parent_id && taskMap[t.parent_id]) {
        taskMap[t.parent_id].children.push(taskMap[t.id]);
      } else {
        roots.push(taskMap[t.id]);
      }
    });
    const applySort = (nodes) => {
      if (sortBy !== '') nodes.sort(sortedCompare);
      nodes.forEach(n => applySort(n.children));
      return nodes;
    };
    return applySort(roots);
  }, [tasks, sortBy, sortDir]);

  const matchesFilter = (t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && String(t.assignee_id) !== filterAssignee) return false;
    if (filterLabel && !(t.labels ? t.labels.split(',').map(l => l.trim().toLowerCase()) : []).includes(filterLabel.toLowerCase())) return false;
    if (filterSprint && t.sprint_name !== filterSprint) return false;
    if (filterMilestone && t.milestone_name !== filterMilestone) return false;
    if (filterDue === 'overdue' && !isOverdue(t.due_date, t.status)) return false;
    if (filterDue === 'today' && !(t.due_date && String(t.due_date) === todayStr())) return false;
    if (filterDue === 'week' && !inDueWeek(t.due_date, todayStr())) return false;
    return true;
  };

  const flattenTree = (nodes, depth = 0) => {
    const result = [];
    for (const node of nodes) {
      const matches = matchesFilter(node);
      const hasMatchingDescendant = node.children.length > 0 && node.children.some(c => {
        const check = (n) => matchesFilter(n) || n.children.some(check);
        return check(c);
      });
      if (matches || hasMatchingDescendant) {
        result.push({ ...node, depth, hasChildren: node.children.length > 0 });
        if (!collapsed[node.id]) {
          result.push(...flattenTree(node.children, depth + 1));
        }
      }
    }
    return result;
  };

  const filtered = useMemo(() => flattenTree(tree), [tree, filterStatus, filterPriority, filterAssignee, filterLabel, filterSprint, filterMilestone, filterDue, collapsed]);

  const distinctLabels = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => {
      if (t.labels) {
        t.labels.split(',').forEach(l => {
          const v = l.trim();
          if (v) set.add(v);
        });
      }
    });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
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

  const statusLabel = (s) => {
    const map = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
    return map[s] || s;
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, status: task.status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(task.id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e, targetTask) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data.taskId === targetTask.id) return;
    if (onReorder) {
      onReorder(data.taskId, targetTask.status, targetTask.position);
    }
  };

  return (
    <div>
      <div className="task-filters">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="">All Assignees</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
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
        <select value={filterDue} onChange={e => setFilterDue(e.target.value)}>
          <option value="">All Due</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due Today</option>
          <option value="week">Due This Week</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="">Sort by: None</option>
          <option value="priority">Sort by: Priority</option>
          <option value="due_date">Sort by: Due Date</option>
          <option value="status">Sort by: Status</option>
          <option value="assignee">Sort by: Assignee</option>
          <option value="title">Sort by: Title</option>
        </select>
        <button
          type="button"
          className="sort-toggle"
          disabled={!sortBy}
          onClick={() => setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'))}
          title={sortDir === 'asc' ? 'Sort: Ascending' : 'Sort: Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={collapseAll} title="Collapse all subtasks">Collapse all</button>
        <button type="button" className="btn-ghost btn-sm" onClick={expandAll} title="Expand all subtasks">Expand all</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No tasks match the filters.</div>
      ) : (
        <div className="task-table-wrap">
          <div className="task-table">
            <div className="task-table-head task-table-row">
              <div className="task-table-cell">Title</div>
              <div className="task-table-cell">Labels</div>
              <div className="task-table-cell">Status</div>
              <div className="task-table-cell">Priority</div>
              <div className="task-table-cell">Assignee</div>
              <div className="task-table-cell">Due Date</div>
              <div className="task-table-cell">Est. Hours</div>
              <div className="task-table-cell">Spent</div>
            </div>
            {filtered.map(task => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                draggable={!readOnly}
                onDragStart={!readOnly ? (e) => handleDragStart(e, task) : undefined}
                onDragOver={!readOnly ? (e) => handleDragOver(e, task) : undefined}
                onDragLeave={!readOnly ? handleDragLeave : undefined}
                onDrop={!readOnly ? (e) => handleDrop(e, task) : undefined}
                className={`task-table-row task-row ${task.archived ? 'archived' : ''} ${task.depth > 0 ? 'subtask-row' : ''} ${dragOverId === task.id ? 'drag-over' : ''} ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`}
              >
                <div className="task-table-cell task-title-cell" style={{ paddingLeft: `${0.75 + task.depth * 1.5}rem` }}>
                  {task.hasChildren ? (
                    <span className="subtask-toggle" onClick={e => { e.stopPropagation(); toggleCollapse(task.id); }}>
                      {collapsed[task.id] ? '▶' : '▼'}
                    </span>
                  ) : task.depth > 0 ? (
                    <span className="subtask-toggle" style={{ visibility: 'hidden' }}>▶</span>
                  ) : null}
                  {task.title}
                  {task.subtask_count > 0 && (
                    <span className="subtask-count">{task.subtask_count}</span>
                  )}
                  {task.recurrence && task.recurrence !== 'none' && (
                    <span className="recurrence-badge" title={`Recurring: ${task.recurrence}`}>↻</span>
                  )}
                  {task.blockedBy && task.blockedBy.some(d => d.status !== 'done') && (
                    <span className="blocked-badge" title="Blocked by incomplete dependencies">⛔</span>
                  )}
                  {task.checklist_progress && task.checklist_progress.total > 0 && (
                    <span className={`checklist-chip ${task.checklist_progress.completed === task.checklist_progress.total ? 'complete' : ''}`}>
                      ☑ {task.checklist_progress.completed}/{task.checklist_progress.total}
                    </span>
                  )}
                </div>
                <div className="task-table-cell">
                  {task.labels ? task.labels.split(',').map((l, i) => (
                    <span key={i} className="label-badge">{l.trim()}</span>
                  )) : '-'}
                  {task.sprint_name && <span className="badge badge-todo">{task.sprint_name}</span>}
                  {task.milestone_name && <span className="badge badge-in_progress">{task.milestone_name}</span>}
                </div>
                <div className="task-table-cell">
                  <select
                    value={task.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => onStatusChange(task.id, e.target.value)}
                    className="status-select"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="task-table-cell"><span className={`badge badge-${task.priority}`}>{task.priority}</span></div>
                <div className="task-table-cell">{task.assignee_name || '-'}</div>
                <div className="task-table-cell date-cell">
                  {task.due_date ? (
                    <span className={isOverdue(task.due_date, task.status) ? 'due-date overdue' : 'due-date'}>{task.due_date}</span>
                  ) : '-'}
                  {(() => {
                    const info = dueInfo(task.due_date, task.status);
                    if (!info) return null;
                    const cls = info.overdue ? 'due-chip due-chip-overdue' : (info.days === 0 ? 'due-chip due-chip-today' : 'due-chip');
                    return <span className={cls}>{info.label}</span>;
                  })()}
                </div>
                <div className="task-table-cell date-cell">{task.estimated_hours != null ? `${task.estimated_hours}h` : '-'}</div>
                <div className="task-table-cell date-cell">{task.time_spent != null ? `${task.time_spent}h` : '-'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
