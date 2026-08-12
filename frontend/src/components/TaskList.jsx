import { useState, useMemo } from 'react';
import './TaskList.css';

export default function TaskList({ tasks, users, onTaskClick, onStatusChange }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && String(t.assignee_id) !== filterAssignee) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority, filterAssignee]);

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
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} onClick={() => onTaskClick(task)} className="task-row">
                  <td className="task-title-cell">{task.title}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
