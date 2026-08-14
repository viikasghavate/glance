import { useState, useMemo } from 'react';
import './TaskList.css';

export default function TaskList({ tasks, users, onTaskClick, onStatusChange }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [collapsed, setCollapsed] = useState({});

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
          <table className="task-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Labels</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due Date</th>
                <th>Est. Hours</th>
                <th>Spent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} onClick={() => onTaskClick(task)} className={`task-row ${task.archived ? 'archived' : ''} ${task.depth > 0 ? 'subtask-row' : ''}`}>
                  <td className="task-title-cell" style={{ paddingLeft: `${0.75 + task.depth * 1.5}rem` }}>
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
                  </td>
                  <td>
                    {task.labels ? task.labels.split(',').map((l, i) => (
                      <span key={i} className="label-badge">{l.trim()}</span>
                    )) : '-'}
                  </td>
                  <td>
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
                  </td>
                  <td><span className={`badge badge-${task.priority}`}>{task.priority}</span></td>
                  <td>{task.assignee_name || '-'}</td>
                  <td className="date-cell">{task.due_date || '-'}</td>
                  <td className="date-cell">{task.estimated_hours != null ? `${task.estimated_hours}h` : '-'}</td>
                  <td className="date-cell">{task.time_spent != null ? `${task.time_spent}h` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
