import { useState, useEffect } from 'react';
import './TaskDetailModal.css';

export default function TaskDetailModal({ task, tasks, users, onClose, onUpdate, onDelete, apiFetch, readOnly }) {
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parentId, setParentId] = useState(task.parent_id || '');
  const [dependsOnId, setDependsOnId] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [checklistText, setChecklistText] = useState('');
  const [loadingChecklist, setLoadingChecklist] = useState(true);

  const parentTask = tasks?.find(t => t.id === task.parent_id) || null;
  const subtasks = tasks?.filter(t => t.parent_id === task.id) || [];

  const blockedBy = task.blockedBy || [];
  const blocks = task.blocks || [];

  const eligibleDependencies = (tasks || []).filter(t => {
    if (t.id === task.id) return false;
    if (blockedBy.some(d => d.id === t.id)) return false;
    const visited = new Set();
    const queue = [t.id];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === task.id) return false;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const t2 = tasks.find(x => x.id === cur);
      if (t2 && t2.blockedBy) {
        t2.blockedBy.forEach(d => queue.push(d.id));
      }
    }
    return true;
  });

  const eligibleParents = (tasks || []).filter(t => {
    if (t.id === task.id) return false;
    const checkDescendant = (id) => {
      const children = tasks.filter(c => c.parent_id === id);
      for (const child of children) {
        if (child.id === t.id) return true;
        if (checkDescendant(child.id)) return true;
      }
      return false;
    };
    if (checkDescendant(task.id)) return false;
    return true;
  });

  const fetchComments = async () => {
    try {
      const data = await apiFetch(`/comments/task/${task.id}`);
      setComments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => { fetchComments(); }, [task.id]);

  const fetchChecklist = async () => {
    try {
      const data = await apiFetch(`/tasks/${task.id}/checklist`);
      setChecklist(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChecklist(false);
    }
  };

  useEffect(() => { fetchChecklist(); }, [task.id]);

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    if (!checklistText.trim()) return;
    try {
      const item = await apiFetch(`/tasks/${task.id}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ text: checklistText.trim() })
      });
      setChecklist(prev => [...prev, item]);
      setChecklistText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleChecklistItem = async (item) => {
    try {
      const updated = await apiFetch(`/tasks/checklist/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: item.completed ? 0 : 1 })
      });
      setChecklist(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChecklistItem = async (itemId) => {
    try {
      await apiFetch(`/tasks/checklist/${itemId}`, { method: 'DELETE' });
      setChecklist(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveChecklistItem = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= checklist.length) return;
    const reordered = [...checklist];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    setChecklist(reordered);
    try {
      const data = await apiFetch(`/tasks/${task.id}/checklist/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orderedIds: reordered.map(i => i.id) })
      });
      setChecklist(data);
    } catch (err) {
      console.error(err);
      fetchChecklist();
    }
  };

  const checklistDone = checklist.filter(i => i.completed).length;

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      const comment = await apiFetch(`/comments/task/${task.id}`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() })
      });
      setComments(prev => [...prev, comment]);
      setCommentBody('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleParentChange = (e) => {
    const val = e.target.value;
    setParentId(val);
    onUpdate({ parent_id: val ? Number(val) : null });
  };

  const handleAddDependency = async () => {
    if (!dependsOnId) return;
    try {
      const updated = await apiFetch(`/tasks/${task.id}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ depends_on_id: Number(dependsOnId) })
      });
      onUpdate(updated);
      setDependsOnId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveDependency = async (depId) => {
    try {
      const updated = await apiFetch(`/tasks/${task.id}/dependencies/${depId}`, { method: 'DELETE' });
      onUpdate(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const statusLabel = (s) => {
    const map = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
    return map[s] || s;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="task-detail-header">
          <h2>{task.title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>&times;</button>
        </div>

        <div className="task-detail-meta">
          <span className={`badge badge-${task.status}`}>{statusLabel(task.status)}</span>
          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
          {task.archived && <span className="badge badge-low">Archived</span>}
          {task.recurrence && task.recurrence !== 'none' && (
            <span className="badge badge-medium">↻ {task.recurrence}</span>
          )}
          {task.assignee_name && <span className="meta-item">Assigned to: {task.assignee_name}</span>}
          {task.reporter_name && <span className="meta-item">Reporter: {task.reporter_name}</span>}
          {task.due_date && <span className="meta-item">Due: {task.due_date}</span>}
          {task.start_date && <span className="meta-item">Start: {task.start_date}</span>}
          {task.estimated_hours != null && <span className="meta-item">Est: {task.estimated_hours}h</span>}
          {task.time_spent != null && task.time_spent > 0 && <span className="meta-item">Spent: {task.time_spent}h</span>}
        </div>

        {task.labels && (
          <div className="task-detail-labels">
            {task.labels.split(',').map((l, i) => (
              <span key={i} className="label-badge">{l.trim()}</span>
            ))}
          </div>
        )}

        <div className="task-detail-relations">
          <div className="relation-section">
            <h4>Parent Task</h4>
            {readOnly ? (
              parentTask ? (
                <span className="relation-link">{parentTask.title}</span>
              ) : (
                <span className="empty">None</span>
              )
            ) : (
              <select value={parentId} onChange={handleParentChange} className="relation-select">
                <option value="">None (top-level task)</option>
                {eligibleParents.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
          </div>
          <div className="relation-section">
            <h4>Subtasks ({subtasks.length})</h4>
            {subtasks.length === 0 ? (
              <span className="empty">No subtasks</span>
            ) : (
              <div className="subtask-list">
                {subtasks.map(st => (
                  <div key={st.id} className="subtask-item">
                    <span className={`badge badge-${st.status}`}>{statusLabel(st.status)}</span>
                    <span className="subtask-item-title">{st.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relation-section">
            <h4>Blocked by ({blockedBy.length})</h4>
            {blockedBy.length === 0 ? (
              <span className="empty">No dependencies</span>
            ) : (
              <div className="subtask-list">
                {blockedBy.map(d => (
                  <div key={d.id} className="subtask-item">
                    <span className={`badge badge-${d.status}`}>{statusLabel(d.status)}</span>
                    <span className="subtask-item-title">{d.title}</span>
                    {!readOnly && (
                      <button className="btn-ghost btn-sm" onClick={() => handleRemoveDependency(d.id)}>&times;</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="dependency-add">
                <select value={dependsOnId} onChange={e => setDependsOnId(e.target.value)}>
                  <option value="">Add dependency...</option>
                  {eligibleDependencies.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <button className="btn-primary btn-sm" onClick={handleAddDependency} disabled={!dependsOnId}>Add</button>
              </div>
            )}
          </div>
          <div className="relation-section">
            <h4>Blocks ({blocks.length})</h4>
            {blocks.length === 0 ? (
              <span className="empty">Nothing blocked</span>
            ) : (
              <div className="subtask-list">
                {blocks.map(d => (
                  <div key={d.id} className="subtask-item">
                    <span className={`badge badge-${d.status}`}>{statusLabel(d.status)}</span>
                    <span className="subtask-item-title">{d.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {task.description && (
          <div className="task-detail-desc">
            <h4>Description</h4>
            <p>{task.description}</p>
          </div>
        )}

        {!readOnly && (
          <div className="task-detail-actions">
            <select
              value={task.status}
              onChange={e => onUpdate({ status: e.target.value })}
              className="status-select"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <button className="btn-danger btn-sm" onClick={onDelete}>Delete Task</button>
          </div>
        )}

        <div className="checklist-section">
          <h4>Checklist {checklist.length > 0 && <span className="checklist-progress">{checklistDone}/{checklist.length} done</span>}</h4>
          {loadingChecklist ? (
            <div className="loading"><div className="spinner" /></div>
          ) : checklist.length === 0 ? (
            <p className="empty">No checklist items.</p>
          ) : (
            <div className="checklist-list">
              {checklist.map((item, idx) => (
                <div key={item.id} className={`checklist-item ${item.completed ? 'completed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!item.completed}
                    onChange={() => handleToggleChecklistItem(item)}
                    disabled={readOnly}
                  />
                  <span className="checklist-item-text">{item.text}</span>
                  {!readOnly && (
                    <div className="checklist-item-actions">
                      <button className="btn-ghost btn-sm" onClick={() => handleMoveChecklistItem(idx, -1)} disabled={idx === 0} title="Move up">↑</button>
                      <button className="btn-ghost btn-sm" onClick={() => handleMoveChecklistItem(idx, 1)} disabled={idx === checklist.length - 1} title="Move down">↓</button>
                      <button className="btn-ghost btn-sm" onClick={() => handleDeleteChecklistItem(item.id)} title="Delete">&times;</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <form onSubmit={handleAddChecklistItem} className="checklist-form">
              <input
                type="text"
                value={checklistText}
                onChange={e => setChecklistText(e.target.value)}
                placeholder="Add checklist item..."
              />
              <button type="submit" className="btn-primary btn-sm" disabled={!checklistText.trim()}>Add</button>
            </form>
          )}
        </div>

        <div className="comments-section">
          <h4>Comments</h4>
          {loadingComments ? (
            <div className="loading"><div className="spinner" /></div>
          ) : comments.length === 0 ? (
            <p className="empty">No comments yet.</p>
          ) : (
            <div className="comments-list">
              {comments.map(c => (
                <div key={c.id} className="comment">
                  <div className="comment-header">
                    <span className="comment-author">{c.user_name}</span>
                    <span className="comment-date">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="comment-body">{c.body}</p>
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <form onSubmit={handleAddComment} className="comment-form">
              <textarea
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
              />
              <button type="submit" className="btn-primary btn-sm" disabled={submitting || !commentBody.trim()}>
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
