import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import './ProjectListPage.css';

const statusLabels = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived'
};

export default function ProjectListPage() {
  const { apiFetch, hasRole } = useAuth();
  const {
    projects, projectsLoading, refreshProjects,
    openNewProjectModal, openEditProjectModal
  } = useUI();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const filteredProjects = projects.filter(p => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.owner_name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'archived') {
      matchesStatus = !!p.archived;
    } else if (statusFilter !== 'all') {
      matchesStatus = p.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (project) => {
    if (!confirm(`Delete project "${project.name}"? This will also delete all tasks and comments.`)) return;
    await apiFetch(`/projects/${project.id}`, { method: 'DELETE' });
    refreshProjects();
  };

  const handleArchive = async (project) => {
    await apiFetch(`/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: !project.archived })
    });
    refreshProjects();
  };

  if (projectsLoading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        {!hasRole('viewer') && (
          <button className="btn-primary" onClick={openNewProjectModal}>
            + New Project
          </button>
        )}
      </div>

      <div className="project-filters">
        <input
          type="text"
          className="project-search"
          placeholder="Search by name, owner, or description"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="project-status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="empty">No projects yet. Create your first project to get started.</div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty">No projects match your filters.</div>
      ) : (
        <div className="project-grid">
          {filteredProjects.map(p => (
            <div key={p.id} className={`project-card ${p.archived ? 'archived' : ''}`}>
              <div className="project-card-bar" style={{ background: p.color }} />
              <div className="project-card-body">
                <Link to={`/project/${p.id}`} className="project-card-name">{p.name}</Link>
                {p.description && <p className="project-card-desc">{p.description}</p>}
                <div className="project-card-meta">
                  <span className={`badge badge-${p.status === 'active' ? 'done' : p.status === 'on_hold' ? 'medium' : p.status === 'completed' ? 'done' : 'low'}`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                  <span className={`badge badge-${p.priority}`}>{p.priority}</span>
                  {p.owner_name && <span className="meta-owner">{p.owner_name}</span>}
                </div>
                {p.tags && (
                  <div className="project-card-tags">
                    {p.tags.split(',').map((t, i) => (
                      <span key={i} className="label-badge">{t.trim()}</span>
                    ))}
                  </div>
                )}
                <div className="project-card-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${p.progress || 0}%` }} />
                  </div>
                  <span className="progress-text">{p.progress || 0}%</span>
                </div>
                <div className="project-card-counts">
                  <span className="count-item"><span className="count-dot todo" /> {p.taskCounts?.todo || 0} To Do</span>
                  <span className="count-item"><span className="count-dot in_progress" /> {p.taskCounts?.in_progress || 0} In Progress</span>
                  <span className="count-item"><span className="count-dot done" /> {p.taskCounts?.done || 0} Done</span>
                </div>
                {!hasRole('viewer') && (
                  <div className="project-card-actions">
                    <button className="btn-ghost btn-sm" onClick={() => openEditProjectModal(p)}>Edit</button>
                    <button className="btn-ghost btn-sm" onClick={() => handleArchive(p)}>
                      {p.archived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
