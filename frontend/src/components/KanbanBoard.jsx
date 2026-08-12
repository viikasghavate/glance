import { useState } from 'react';
import './KanbanBoard.css';

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' }
];

export default function KanbanBoard({ tasks, users, onReorder, onTaskClick, onEditTask }) {
  const [dragOverCol, setDragOverCol] = useState(null);

  const getTasks = (status) => tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);

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
      {COLUMNS.map(col => {
        const colTasks = getTasks(col.key);
        return (
          <div
            key={col.key}
            className={`kanban-col ${dragOverCol === col.key ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
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
                  className={`kanban-card ${task.archived ? 'archived' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragOver={handleTaskDragOver}
                  onDrop={(e) => handleTaskDrop(e, task, col.key)}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="kanban-card-title">{task.title}</div>
                  {task.labels && (
                    <div className="kanban-card-labels">
                      {task.labels.split(',').map((l, i) => (
                        <span key={i} className="label-badge">{l.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div className="kanban-card-meta">
                    <span className={priorityClass(task.priority)}>{task.priority}</span>
                    {task.assignee_name && (
                      <span className="assignee">{task.assignee_name}</span>
                    )}
                    {task.due_date && (
                      <span className="due-date">{task.due_date}</span>
                    )}
                    {task.estimated_hours != null && (
                      <span className="est-hours">{task.estimated_hours}h</span>
                    )}
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="kanban-empty">No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
