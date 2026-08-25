import { useState } from 'react';

const STATUS_LABELS = { open: 'Open', completed: 'Completed' };

export default function MilestoneSection({ projectId, milestones, onRefresh, apiFetch, readOnly }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('open');
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setDueDate('');
    setStatus('open');
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setName(m.name);
    setDescription(m.description || '');
    setDueDate(m.due_date || '');
    setStatus(m.status);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await apiFetch(`/milestones/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: name.trim(), description: description.trim(), due_date: dueDate || null, status })
        });
      } else {
        await apiFetch(`/projects/${projectId}/milestones`, {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), description: description.trim(), due_date: dueDate || null })
        });
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`Delete milestone "${m.name}"? Tasks will be unassigned from it.`)) return;
    await apiFetch(`/milestones/${m.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleStatus = async (m, newStatus) => {
    await apiFetch(`/milestones/${m.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    onRefresh();
  };

  return (
    <div className="panel">
      <div className="section-head">
        <h2 className="panel-title">Milestones</h2>
        {!readOnly && <button className="btn-ghost btn-sm" onClick={openCreate}>+ New Milestone</button>}
      </div>
      {milestones.length === 0 ? (
        <div className="empty">No milestones yet.</div>
      ) : (
        <div className="sprint-list">
          {milestones.map(m => (
            <div key={m.id} className="sprint-item">
              <div className="sprint-item-head">
                <span className="sprint-name">{m.name}</span>
                <span className={`badge badge-${m.status === 'completed' ? 'done' : 'todo'}`}>
                  {STATUS_LABELS[m.status] || m.status}
                </span>
                <span className="sprint-count">{m.task_count} tasks</span>
              </div>
              {m.description && <div className="sprint-goal">{m.description}</div>}
              {m.due_date && <div className="sprint-dates"><span>Due: {m.due_date}</span></div>}
              {!readOnly && (
                <div className="sprint-actions">
                  {m.status !== 'completed' && <button className="btn-ghost btn-sm" onClick={() => handleStatus(m, 'completed')}>Complete</button>}
                  {m.status === 'completed' && <button className="btn-ghost btn-sm" onClick={() => handleStatus(m, 'open')}>Reopen</button>}
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>
                  <button className="btn-ghost btn-sm" onClick={() => handleDelete(m)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Milestone' : 'New Milestone'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="mname">Name</label>
                <input id="mname" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="mdesc">Description</label>
                <textarea id="mdesc" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="mdue">Due Date</label>
                <input id="mdue" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              {editing && (
                <div className="form-group">
                  <label htmlFor="mstatus">Status</label>
                  <select id="mstatus" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="open">Open</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editing ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
