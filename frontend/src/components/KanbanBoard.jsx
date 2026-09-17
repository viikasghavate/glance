import { useState, useMemo } from 'react';
import './KanbanBoard.css';
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

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' }
];

export default function KanbanBoard({ tasks, users, onReorder, onTaskClick, onEditTask, readOnly }) {
  const [dragOverCol, setDragOverCol] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [filterLabel, setFilterLabel] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterSprint, setFilterSprint] = useState('');
  const [filterMilestone, setFilterMilestone] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const anyFilter =
    search !== '' ||
    sortBy !== '' ||
    sortDir !== 'asc' ||
    filterLabel !== '' ||
    filterPriority !== '' ||
    filterAssignee !== '' ||
    filterSprint !== '' ||
    filterMilestone !== '' ||
    filterDue !== '';

  const clearFilters = () => {
    setSearch('');
    setSortBy('');
    setSortDir('asc');
    setFilterLabel('');
    setFilterPriority('');
    setFilterAssignee('');
    setFilterSprint('');
    setFilterMilestone('');
    setFilterDue('');
  };

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
    const parentIds = COLUMNS.flatMap(col => getTasks(col.key)).filter(t => t.hasChildren).map(t => t.id);
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
    return roots;
  }, [tasks]);

  const flattenTree = (nodes, depth = 0) => {
    const result = [];
    for (const node of nodes) {
      result.push({ ...node, depth, hasChildren: node.children.length > 0 });
      if (!collapsed[node.id]) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  };

  const getTasks = (status) => {
    const flat = flattenTree(tree);
    return flat
      .filter(t => t.status === status)
      .filter(t => {
        if (!search) return true;
        const q = search.trim().toLowerCase();
        const labelNames = t.labelList && t.labelList.length
          ? t.labelList.map(l => (l.name || '').toLowerCase())
          : (t.labels ? t.labels.split(',').map(l => l.trim().toLowerCase()) : []);
        const haystack = [
          t.title,
          t.description,
          t.project_name,
          t.sprint_name,
          t.milestone_name,
          ...labelNames
        ].filter(v => v != null).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .filter(t => !filterLabel || (t.labels ? t.labels.split(',').map(l => l.trim().toLowerCase()) : []).includes(filterLabel.toLowerCase()))
      .filter(t => !filterPriority || t.priority === filterPriority)
      .filter(t => !filterAssignee || String(t.assignee_id) === filterAssignee)
      .filter(t => !filterSprint || t.sprint_name === filterSprint)
      .filter(t => !filterMilestone || t.milestone_name === filterMilestone)
      .filter(t => !filterDue || dueMatches(t, filterDue))
      .sort(sortBy === '' ? (a, b) => a.position - b.position : sortedCompare);
  };

  const dueMatches = (t, filterDue) => {
    if (filterDue === 'overdue') return isOverdue(t.due_date, t.status);
    if (filterDue === 'today') return !!(t.due_date && String(t.due_date) === todayStr());
    if (filterDue === 'week') return inDueWeek(t.due_date, todayStr());
    return true;
  };

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

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, status: task.status, position: task.position }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    setDragOverCol(null);
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const colTasks = getTasks(status);
    const position = colTasks.length;
    onReorder(data.taskId, status, position);
  };

  const handleTaskDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTaskDrop = (e, targetTask, status) => {
    e.preventDefault();
    e.stopPropagation();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    onReorder(data.taskId, status, targetTask.position);
  };

  const priorityClass = (p) => `badge badge-${p}`;

  return (
    <div className="kanban">
      <div className="kanban-filters">
        <input
          type="text"
          className="timeline-search"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
          <option value="">All Labels</option>
          {distinctLabels.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
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
        {anyFilter && (
          <button type="button" className="toolbar-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={collapseAll} title="Collapse all subtasks">Collapse all</button>
        <button type="button" className="btn-ghost btn-sm" onClick={expandAll} title="Expand all subtasks">Expand all</button>
      </div>
      {tasks.length === 0 && (
        <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
          {readOnly
            ? 'No tasks match the current filters.'
            : 'No tasks yet. Click "New Task" to add one, or clear your filters.'}
        </div>
      )}
      {COLUMNS.map(col => {
        const colTasks = getTasks(col.key);
        return (
          <div
            key={col.key}
            className={`kanban-col ${dragOverCol === col.key ? 'drag-over' : ''}`}
            onDragOver={!readOnly ? (e) => handleDragOver(e, col.key) : undefined}
            onDragLeave={!readOnly ? handleDragLeave : undefined}
            onDrop={!readOnly ? (e) => handleDrop(e, col.key) : undefined}
          >
            <div className="kanban-col-header">
              <span className={`col-dot ${col.key}`} />
              <span>{col.label}</span>
              <span className="col-count">{colTasks.length}</span>
            </div>
            <div className="kanban-col-body">
              {colTasks.map(task => (
                <div
                  key={task.id}
                  className={`kanban-card ${task.archived ? 'archived' : ''} ${task.depth > 0 ? 'subtask-card' : ''} ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`}
                  draggable={!readOnly}
                  onDragStart={!readOnly ? (e) => handleDragStart(e, task) : undefined}
                  onDragOver={!readOnly ? handleTaskDragOver : undefined}
                  onDrop={!readOnly ? (e) => handleTaskDrop(e, task, col.key) : undefined}
                  onClick={() => onTaskClick(task)}
                  style={{ marginLeft: task.depth > 0 ? `${task.depth * 1}rem` : undefined }}
                >
                  <div className="kanban-card-title">
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
                    {task.comment_count > 0 && (
                      <span className="comment-count" title={`${task.comment_count} comment${task.comment_count === 1 ? '' : 's'}`}>💬 {task.comment_count}</span>
                    )}
                    {task.recurrence && task.recurrence !== 'none' && (
                      <span className="recurrence-badge" title={`Recurring: ${task.recurrence}`}>↻</span>
                    )}
                    {task.blockedBy && task.blockedBy.some(d => d.status !== 'done') && (
                      <span className="blocked-badge" title="Blocked by incomplete dependencies">⛔</span>
                    )}
                  </div>
                  {task.labels && (
                    <div className="kanban-card-labels">
                      {task.labels.split(',').map((l, i) => (
                        <span key={i} className="label-badge">{l.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div className="kanban-card-meta">
                    <span className={priorityClass(task.priority)}>{task.priority}</span>
                    {task.sprint_name && (
                      <span className="badge badge-todo" title={`Sprint: ${task.sprint_name}`}>{task.sprint_name}</span>
                    )}
                    {task.milestone_name && (
                      <span className="badge badge-in_progress" title={`Milestone: ${task.milestone_name}`}>{task.milestone_name}</span>
                    )}
                    {task.assignee_name && (
                      <span className="assignee">{task.assignee_name}</span>
                    )}
    {task.due_date && (
      <>
        <span className="due-date">{task.due_date}</span>
        {(() => {
          const info = dueInfo(task.due_date, task.status);
          if (!info) return null;
          const cls = info.overdue ? 'due-chip due-chip-overdue' : (info.days === 0 ? 'due-chip due-chip-today' : 'due-chip');
          return <span className={cls}>{info.label}</span>;
        })()}
        {isOverdue(task.due_date, task.status) && (
          <span className="overdue-chip">⚠ Overdue</span>
        )}
      </>
    )}
                    {task.estimated_hours != null && (
                      <span className="est-hours">{task.estimated_hours}h</span>
                    )}
                    {task.checklist_progress && task.checklist_progress.total > 0 && (
                      <span className={`checklist-chip ${task.checklist_progress.completed === task.checklist_progress.total ? 'complete' : ''}`}>
                        ☑ {task.checklist_progress.completed}/{task.checklist_progress.total}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="kanban-empty">{search ? 'No tasks match the filters.' : 'No tasks'}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
