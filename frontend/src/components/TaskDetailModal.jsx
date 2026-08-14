import { useState, useEffect } from 'react';
import './TaskDetailModal.css';

export default function TaskDetailModal({ task, users, onClose, onUpdate, onDelete, apiFetch, readOnly }) {
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
