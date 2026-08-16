import { useState, useMemo } from 'react';
import './KanbanBoard.css';

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' }
];

export default function KanbanBoard({ tasks, users, onReorder, onTaskClick, onEditTask, readOnly }) {
  const [dragOverCol, setDragOverCol] = useState(null);
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
    return flat.filter(t => t.status === status).sort((a, b) => a.position - b.position);
  };

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
                  className={`kanban-card ${task.archived ? 'archived' : ''} ${task.depth > 0 ? 'subtask-card' : ''}`}
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
