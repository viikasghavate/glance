import { useState } from 'react';

const STATUS_LABELS = { planned: 'Planned', active: 'Active', completed: 'Completed' };

export default function SprintSection({ projectId, sprints, onRefresh, apiFetch, readOnly }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('planned');
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setGoal('');
    setStartDate('');
    setEndDate('');
    setStatus('planned');
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setName(s.name);
    setGoal(s.goal || '');
    setStartDate(s.start_date || '');
    setEndDate(s.end_date || '');
    setStatus(s.status);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await apiFetch(`/sprints/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: name.trim(), goal: goal.trim(), start_date: startDate || null, end_date: endDate || null, status })
        });
      } else {
        await apiFetch(`/projects/${projectId}/sprints`, {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), goal: goal.trim(), start_date: startDate || null, end_date: endDate || null })
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

  const handleDelete = async (s) => {
    if (!confirm(`Delete sprint "${s.name}"? Tasks will be unassigned from it.`)) return;
    await apiFetch(`/sprints/${s.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleStatus = async (s, newStatus) => {
    await apiFetch(`/sprints/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    onRefresh();
  };

  return (
    <div className="panel">
      <div className="section-head">
        <h2 className="panel-title">Sprints</h2>
        {!readOnly && <button className="btn-ghost btn-sm" onClick={openCreate}>+ New Sprint</button>}
      </div>
      {sprints.length === 0 ? (
        <div className="empty">No sprints yet.</div>
      ) : (
        <div className="sprint-list">
          {sprints.map(s => (
            <div key={s.id} className="sprint-item">
              <div className="sprint-item-head">
                <span className="sprint-name">{s.name}</span>
                <span className={`badge badge-${s.status === 'completed' ? 'done' : s.status === 'active' ? 'medium' : 'todo'}`}>
                  {STATUS_LABELS[s.status] || s.status}
                </span>
                <span className="sprint-count">{s.task_count} tasks</span>
              </div>
              {s.goal && <div className="sprint-goal">{s.goal}</div>}
              {(s.start_date || s.end_date) && (
                <div className="sprint-dates">
                  {s.start_date && <span>Start: {s.start_date}</span>}
                  {s.end_date && <span>End: {s.end_date}</span>}
                </div>
              )}
              {!readOnly && (
                <div className="sprint-actions">
                  {s.status !== 'active' && <button className="btn-ghost btn-sm" onClick={() => handleStatus(s, 'active')}>Start</button>}
                  {s.status !== 'completed' && <button className="btn-ghost btn-sm" onClick={() => handleStatus(s, 'completed')}>Complete</button>}
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn-ghost btn-sm" onClick={() => handleDelete(s)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Sprint' : 'New Sprint'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="sname">Name</label>
                <input id="sname" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="sgoal">Goal</label>
                <textarea id="sgoal" value={goal} onChange={e => setGoal(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="sstart">Start Date</label>
                  <input id="sstart" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="send">End Date</label>
                  <input id="send" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              {editing && (
                <div className="form-group">
                  <label htmlFor="sstatus">Status</label>
                  <select id="sstatus" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
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
