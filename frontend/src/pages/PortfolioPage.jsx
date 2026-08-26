import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import './PortfolioPage.css';

const COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

export default function PortfolioPage() {
  const { apiFetch, hasRole } = useAuth();
  const { portfolios, programs, projects, refreshPortfolios, refreshProjects } = useUI();
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);
  const [programPortfolioId, setProgramPortfolioId] = useState('');

  const canEdit = !hasRole('viewer');

  const openNewPortfolio = () => { setEditingPortfolio(null); setShowPortfolioModal(true); };
  const openEditPortfolio = (p) => { setEditingPortfolio(p); setShowPortfolioModal(true); };
  const openNewProgram = (portfolioId) => { setEditingProgram(null); setProgramPortfolioId(portfolioId || ''); setShowProgramModal(true); };
  const openEditProgram = (pr) => { setEditingProgram(pr); setProgramPortfolioId(pr.portfolio_id || ''); setShowProgramModal(true); };

  const handleDeletePortfolio = async (p) => {
    if (!confirm(`Delete portfolio "${p.name}"? Its programs will also be deleted.`)) return;
    await apiFetch(`/portfolios/${p.id}`, { method: 'DELETE' });
    refreshPortfolios();
    refreshProjects();
  };

  const handleDeleteProgram = async (pr) => {
    if (!confirm(`Delete program "${pr.name}"?`)) return;
    await apiFetch(`/programs/${pr.id}`, { method: 'DELETE' });
    refreshPortfolios();
    refreshProjects();
  };

  const handleAssignProject = async (projectId, { program_id, portfolio_id }) => {
    await apiFetch(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ program_id, portfolio_id })
    });
    refreshPortfolios();
    refreshProjects();
  };

  const unassignedProjects = projects.filter(p => !p.program_id && !p.portfolio_id);

  return (
    <div>
      <div className="page-header">
        <h1>Portfolios & Programs</h1>
        {canEdit && (
          <button className="btn-primary" onClick={openNewPortfolio}>+ New Portfolio</button>
        )}
      </div>

      {portfolios.length === 0 ? (
        <div className="empty">No portfolios yet. Create a portfolio to organize your projects.</div>
      ) : (
        <div className="portfolio-list">
          {portfolios.map(pf => (
            <div key={pf.id} className="portfolio-card">
              <div className="portfolio-card-bar" style={{ background: pf.color }} />
              <div className="portfolio-card-body">
                <div className="portfolio-card-header">
                  <div>
                    <h2 className="portfolio-card-name">{pf.name}</h2>
                    {pf.description && <p className="portfolio-card-desc">{pf.description}</p>}
                  </div>
                  <div className="portfolio-card-meta">
                    <span className="badge badge-medium">{pf.projectCount} projects</span>
                    {canEdit && (
                      <div className="portfolio-card-actions">
                        <button className="btn-ghost btn-sm" onClick={() => openNewProgram(pf.id)}>+ Program</button>
                        <button className="btn-ghost btn-sm" onClick={() => openEditPortfolio(pf)}>Edit</button>
                        <button className="btn-danger btn-sm" onClick={() => handleDeletePortfolio(pf)}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>

                {pf.programs.length > 0 && (
                  <div className="program-list">
                    {pf.programs.map(pr => (
                      <div key={pr.id} className="program-item">
                        <div className="program-item-header">
                          <span className="program-dot" style={{ background: pr.color }} />
                          <span className="program-name">{pr.name}</span>
                          <span className="program-count">{pr.projectCount} projects</span>
                          {canEdit && (
                            <div className="program-actions">
                              <button className="btn-ghost btn-sm" onClick={() => openEditProgram(pr)}>Edit</button>
                              <button className="btn-danger btn-sm" onClick={() => handleDeleteProgram(pr)}>Delete</button>
                            </div>
                          )}
                        </div>
                        <div className="program-projects">
                          {projects.filter(p => p.program_id === pr.id).map(p => (
                            <ProjectRow key={p.id} project={p} portfolios={portfolios} programs={programs} onAssign={handleAssignProject} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pf.projects.length > 0 && (
                  <div className="program-projects">
                    {pf.projects.map(p => (
                      <ProjectRow key={p.id} project={p} portfolios={portfolios} programs={programs} onAssign={handleAssignProject} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unassignedProjects.length > 0 && (
        <div className="unassigned-section">
          <h3 className="unassigned-title">Unassigned Projects</h3>
          <div className="program-projects">
            {unassignedProjects.map(p => (
              <ProjectRow key={p.id} project={p} portfolios={portfolios} programs={programs} onAssign={handleAssignProject} />
            ))}
          </div>
        </div>
      )}

      {showPortfolioModal && (
        <PortfolioModal
          portfolio={editingPortfolio}
          onClose={() => setShowPortfolioModal(false)}
          onSave={async (data) => {
            if (editingPortfolio) {
              await apiFetch(`/portfolios/${editingPortfolio.id}`, { method: 'PATCH', body: JSON.stringify(data) });
            } else {
              await apiFetch('/portfolios', { method: 'POST', body: JSON.stringify(data) });
            }
            setShowPortfolioModal(false);
            refreshPortfolios();
          }}
        />
      )}

      {showProgramModal && (
        <ProgramModal
          program={editingProgram}
          portfolios={portfolios}
          defaultPortfolioId={programPortfolioId}
          onClose={() => setShowProgramModal(false)}
          onSave={async (data) => {
            if (editingProgram) {
              await apiFetch(`/programs/${editingProgram.id}`, { method: 'PATCH', body: JSON.stringify(data) });
            } else {
              await apiFetch('/programs', { method: 'POST', body: JSON.stringify(data) });
            }
            setShowProgramModal(false);
            refreshPortfolios();
          }}
        />
      )}
    </div>
  );
}

function ProjectRow({ project, portfolios, programs, onAssign }) {
  const [portfolioId, setPortfolioId] = useState(project.portfolio_id || '');
  const [programId, setProgramId] = useState(project.program_id || '');

  const handleChange = (field, value) => {
    const nextPortfolio = field === 'portfolio_id' ? value : portfolioId;
    const nextProgram = field === 'program_id' ? value : programId;
    setPortfolioId(nextPortfolio);
    setProgramId(nextProgram);
    onAssign(project.id, {
      portfolio_id: nextPortfolio ? Number(nextPortfolio) : null,
      program_id: nextProgram ? Number(nextProgram) : null
    });
  };

  return (
    <div className="project-row">
      <span className="project-row-dot" style={{ background: project.color }} />
      <span className="project-row-name">{project.name}</span>
      <select
        className="project-row-select"
        value={portfolioId}
        onChange={e => handleChange('portfolio_id', e.target.value)}
      >
        <option value="">No portfolio</option>
        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select
        className="project-row-select"
        value={programId}
        onChange={e => handleChange('program_id', e.target.value)}
      >
        <option value="">No program</option>
        {portfolios.map(p => (
          <optgroup key={p.id} label={p.name}>
            {programs.filter(pr => pr.portfolio_id === p.id).map(pr => (
              <option key={pr.id} value={pr.id}>{pr.name}</option>
            ))}
          </optgroup>
        ))}
        {programs.filter(pr => !pr.portfolio_id).map(pr => (
          <option key={pr.id} value={pr.id}>{pr.name}</option>
        ))}
      </select>
    </div>
  );
}

function PortfolioModal({ portfolio, onClose, onSave }) {
  const [name, setName] = useState(portfolio?.name || '');
  const [description, setDescription] = useState(portfolio?.description || '');
  const [color, setColor] = useState(portfolio?.color || '#6366f1');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), color });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{portfolio ? 'Edit Portfolio' : 'New Portfolio'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pfname">Name</label>
            <input id="pfname" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="pfdesc">Description</label>
            <textarea id="pfdesc" value={description} onChange={e => setDescription(e.target.value)} />
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
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : portfolio ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProgramModal({ program, portfolios, defaultPortfolioId, onClose, onSave }) {
  const [name, setName] = useState(program?.name || '');
  const [description, setDescription] = useState(program?.description || '');
  const [color, setColor] = useState(program?.color || '#6366f1');
  const [portfolioId, setPortfolioId] = useState(program?.portfolio_id || defaultPortfolioId || '');
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
        portfolio_id: portfolioId ? Number(portfolioId) : null
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{program ? 'Edit Program' : 'New Program'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="prname">Name</label>
            <input id="prname" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="prdesc">Description</label>
            <textarea id="prdesc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="prportfolio">Portfolio</label>
            <select id="prportfolio" value={portfolioId} onChange={e => setPortfolioId(e.target.value)}>
              <option value="">None</option>
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : program ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
