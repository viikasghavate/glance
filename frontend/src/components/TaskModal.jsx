import { useState } from 'react';

export default function TaskModal({ task, users, projectId, onClose, onSave }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '');
  const [labels, setLabels] = useState(task?.labels || '');
  const [startDate, setStartDate] = useState(task?.start_date || '');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimated_hours ?? '');
  const [timeSpent, setTimeSpent] = useState(task?.time_spent ?? 0);
  const [reporterId, setReporterId] = useState(task?.reporter_id || '');
  const [archived, setArchived] = useState(!!task?.archived);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        labels: labels.trim(),
        start_date: startDate || null,
        estimated_hours: estimatedHours !== '' ? Number(estimatedHours) : null,
        time_spent: Number(timeSpent),
        reporter_id: reporterId ? Number(reporterId) : null,
        archived: archived ? 1 : 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="ttitle">Title</label>
            <input id="ttitle" type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="tdesc">Description</label>
            <textarea id="tdesc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tstatus">Status</label>
              <select id="tstatus" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="tpriority">Priority</label>
              <select id="tpriority" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tdue">Due Date</label>
              <input id="tdue" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="tassignee">Assignee</label>
              <select id="tassignee" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="tlabels">Labels (comma-separated)</label>
            <input id="tlabels" type="text" value={labels} onChange={e => setLabels(e.target.value)} placeholder="bug, frontend, urgent" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tstart">Start Date</label>
              <input id="tstart" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="testhours">Estimated Hours</label>
              <input id="testhours" type="number" step="0.5" min="0" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="ttimespent">Time Spent (hours)</label>
              <input id="ttimespent" type="number" step="0.5" min="0" value={timeSpent} onChange={e => setTimeSpent(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="treporter">Reporter</label>
              <select id="treporter" value={reporterId} onChange={e => setReporterId(e.target.value)}>
                <option value="">None</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />
              Archived
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
