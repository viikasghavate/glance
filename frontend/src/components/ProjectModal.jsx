import { useState } from 'react';

const COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

export default function ProjectModal({ project, users, portfolios, programs, onClose, onSave }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [color, setColor] = useState(project?.color || '#6366f1');
  const [status, setStatus] = useState(project?.status || 'active');
  const [startDate, setStartDate] = useState(project?.start_date || '');
  const [dueDate, setDueDate] = useState(project?.due_date || '');
  const [ownerId, setOwnerId] = useState(project?.owner_id || '');
  const [priority, setPriority] = useState(project?.priority || 'medium');
  const [progress, setProgress] = useState(project?.progress ?? 0);
  const [tags, setTags] = useState(project?.tags || '');
  const [portfolioId, setPortfolioId] = useState(project?.portfolio_id || '');
  const [programId, setProgramId] = useState(project?.program_id || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        status,
        start_date: startDate || null,
        due_date: dueDate || null,
        owner_id: ownerId ? Number(ownerId) : null,
        priority,
        progress: Number(progress),
        tags: tags.trim(),
        portfolio_id: portfolioId ? Number(portfolioId) : null,
        program_id: programId ? Number(programId) : null
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
        <h2>{project ? 'Edit Project' : 'New Project'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pname">Name</label>
            <input id="pname" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="pdesc">Description</label>
            <textarea id="pdesc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="ptags">Tags</label>
            <input id="ptags" type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated, tags" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="pportfolio">Portfolio</label>
              <select id="pportfolio" value={portfolioId} onChange={e => setPortfolioId(e.target.value)}>
                <option value="">None</option>
                {portfolios && portfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="pprogram">Program</label>
              <select id="pprogram" value={programId} onChange={e => setProgramId(e.target.value)}>
                <option value="">None</option>
                {portfolios && portfolios.map(p => (
                  <optgroup key={p.id} label={p.name}>
                    {(programs || []).filter(pr => pr.portfolio_id === p.id).map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.name}</option>
                    ))}
                  </optgroup>
                ))}
                {(programs || []).filter(pr => !pr.portfolio_id).map(pr => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${c === color ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="pstatus">Status</label>
              <select id="pstatus" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ppriority">Priority</label>
              <select id="ppriority" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="pstart">Start Date</label>
              <input id="pstart" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="pdue">Due Date</label>
              <input id="pdue" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="powner">Owner</label>
              <select id="powner" value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                <option value="">Unassigned</option>
                {users && users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="pprogress">Progress ({progress}%)</label>
              <input id="pprogress" type="range" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : project ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
