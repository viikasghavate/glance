import { useState, useMemo } from 'react';
import './TaskList.css';

export default function TaskList({ tasks, users, onTaskClick, onStatusChange, onReorder, readOnly }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [dragOverId, setDragOverId] = useState(null);

  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
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

  const matchesFilter = (t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && String(t.assignee_id) !== filterAssignee) return false;
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

  const filtered = useMemo(() => flattenTree(tree), [tree, filterStatus, filterPriority, filterAssignee, collapsed]);

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
                className={`task-table-row task-row ${task.archived ? 'archived' : ''} ${task.depth > 0 ? 'subtask-row' : ''} ${dragOverId === task.id ? 'drag-over' : ''}`}
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
                </div>
                <div className="task-table-cell">
                  {task.labels ? task.labels.split(',').map((l, i) => (
                    <span key={i} className="label-badge">{l.trim()}</span>
                  )) : '-'}
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
                <div className="task-table-cell date-cell">{task.due_date || '-'}</div>
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
