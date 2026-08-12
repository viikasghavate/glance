import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProjectModal from '../components/ProjectModal';
import './ProjectListPage.css';

export default function ProjectListPage() {
  const { apiFetch } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const fetchProjects = async () => {
    try {
      const data = await apiFetch('/projects');
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleSave = async (data) => {
    if (editingProject) {
      await apiFetch(`/projects/${editingProject.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      await apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) });
    }
    setShowModal(false);
    setEditingProject(null);
    fetchProjects();
  };

  const handleDelete = async (project) => {
    if (!confirm(`Delete project "${project.name}"? This will also delete all tasks and comments.`)) return;
    await apiFetch(`/projects/${project.id}`, { method: 'DELETE' });
    fetchProjects();
  };

  const handleArchive = async (project) => {
    await apiFetch(`/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: !project.archived })
    });
    fetchProjects();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => { setEditingProject(null); setShowModal(true); }}>
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="empty">No projects yet. Create your first project to get started.</div>
      ) : (
        <div className="project-grid">
          {projects.map(p => (
            <div key={p.id} className={`project-card ${p.archived ? 'archived' : ''}`}>
              <div className="project-card-bar" style={{ background: p.color }} />
              <div className="project-card-body">
                <Link to={`/project/${p.id}`} className="project-card-name">{p.name}</Link>
                {p.description && <p className="project-card-desc">{p.description}</p>}
                <div className="project-card-counts">
                  <span className="count-item"><span className="count-dot todo" /> {p.taskCounts?.todo || 0} To Do</span>
                  <span className="count-item"><span className="count-dot in_progress" /> {p.taskCounts?.in_progress || 0} In Progress</span>
                  <span className="count-item"><span className="count-dot done" /> {p.taskCounts?.done || 0} Done</span>
                </div>
                <div className="project-card-actions">
                  <button className="btn-ghost btn-sm" onClick={() => { setEditingProject(p); setShowModal(true); }}>Edit</button>
                  <button className="btn-ghost btn-sm" onClick={() => handleArchive(p)}>
                    {p.archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(p)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => { setShowModal(false); setEditingProject(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
