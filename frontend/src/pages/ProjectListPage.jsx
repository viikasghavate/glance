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

function projectTagNames(p) {
  let names;
  if (p.tagList && p.tagList.length) {
    names = p.tagList.map(x => (typeof x === 'string' ? x : x && x.name));
  } else {
    names = (p.tags || '').split(',');
  }
  const seen = new Set();
  const result = [];
  for (const n of names) {
    if (n === null || n === undefined) continue;
    const t = String(n).trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    result.push(t);
  }
  return result;
}

export default function ProjectListPage() {
  const { apiFetch, hasRole } = useAuth();
  const {
    projects, projectsLoading, refreshProjects,
    openNewProjectModal, openEditProjectModal
  } = useUI();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const priorityIndex = { low: 0, medium: 1, high: 2 };
  const statusIndex = { active: 0, on_hold: 1, completed: 2, archived: 3 };

  const distinctTags = projects
    .flatMap(p => projectTagNames(p))
    .filter((t, i, arr) => arr.findIndex(x => x.toLowerCase() === t.toLowerCase()) === i)
    .sort((a, b) => a.localeCompare(b));

  const anyFilter =
    search !== '' ||
    statusFilter !== 'all' ||
    tagFilter !== '' ||
    sortBy !== '' ||
    sortDir !== 'asc';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTagFilter('');
    setSortBy('');
    setSortDir('asc');
  };

  const filteredProjects = projects
    .filter(p => {
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

      const matchesTag = !tagFilter ||
        projectTagNames(p).some(t => t.toLowerCase() === tagFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesTag;
    })
    .sort((a, b) => {
      if (sortBy === '') return 0;
      let cmp = 0;
      if (sortBy === 'name') {
        const av = (a.name || '').toLowerCase();
        const bv = (b.name || '').toLowerCase();
        cmp = av < bv ? -1 : av > bv ? 1 : 0;
      } else if (sortBy === 'owner') {
        const ao = a.owner_name ? String(a.owner_name).toLowerCase() : null;
        const bo = b.owner_name ? String(b.owner_name).toLowerCase() : null;
        if (ao === null && bo === null) return 0;
        if (ao === null) return 1;
        if (bo === null) return -1;
        cmp = ao < bo ? -1 : ao > bo ? 1 : 0;
      } else if (sortBy === 'priority') {
        const ai = priorityIndex[a.priority] ?? 0;
        const bi = priorityIndex[b.priority] ?? 0;
        cmp = ai - bi;
      } else if (sortBy === 'status') {
        const ai = statusIndex[a.status] ?? 0;
        const bi = statusIndex[b.status] ?? 0;
        cmp = ai - bi;
      } else if (sortBy === 'progress') {
        const ap = Number(a.progress) || 0;
        const bp = Number(b.progress) || 0;
        cmp = ap - bp;
      } else if (sortBy === 'due_date') {
        const ad = a.due_date ? String(a.due_date) : null;
        const bd = b.due_date ? String(b.due_date) : null;
        if (ad === null && bd === null) return 0;
        if (ad === null) return 1;
        if (bd === null) return -1;
        cmp = ad < bd ? -1 : ad > bd ? 1 : 0;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

  const handleExportCsv = () => {
    const escape = (value) => {
      const s = value === null || value === undefined ? '' : String(value);
      if (/[",\n\r]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const header = [
      'name', 'status', 'priority', 'progress', 'owner', 'start_date',
      'due_date', 'open_tasks', 'overdue_tasks', 'tags', 'created_at'
    ];

    const rows = filteredProjects.map(p => {
      const taskCounts = p.taskCounts || {};
      const tags = projectTagNames(p).join('; ');
      const owner = p.owner_name || '';
      const openTasks = p.taskCounts ? (taskCounts.todo || 0) + (taskCounts.in_progress || 0) : '';
      const overdueTasks = taskCounts.overdue || '';
      return [
        p.name,
        statusLabels[p.status] || p.status,
        p.priority,
        p.progress,
        owner,
        p.start_date,
        p.due_date,
        openTasks,
        overdueTasks,
        tags,
        p.created_at
      ].map(escape).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `projects-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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

  const handleCopyLink = async (e, project) => {
    e.stopPropagation();
    const url = window.location.origin + '/project/' + project.id;
    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error(err);
      }
      document.body.removeChild(textarea);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackCopy();
      }
      setCopiedId(project.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error(err);
      fallbackCopy();
      setCopiedId(project.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  if (projectsLoading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn-ghost" onClick={handleExportCsv}>
            Export CSV
          </button>
          {!hasRole('viewer') && (
            <button className="btn-primary" onClick={openNewProjectModal}>
              + New Project
            </button>
          )}
        </div>
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
        <select
          className="project-status-filter"
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
        >
          <option value="">All Tags</option>
          {distinctTags.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="project-status-filter"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="">Sort by: None</option>
          <option value="name">Sort by: Name</option>
          <option value="priority">Sort by: Priority</option>
          <option value="status">Sort by: Status</option>
          <option value="progress">Sort by: Progress</option>
          <option value="due_date">Sort by: Due Date</option>
          <option value="owner">Sort by: Owner</option>
        </select>
        <button
          type="button"
          className="sort-toggle"
          disabled={!sortBy}
          onClick={() => setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'))}
          title={sortDir === 'asc' ? 'Sort: Ascending' : 'Sort: Descending'}
        >
          {sortDir === 'asc' ? '▲' : '▼'}
        </button>
        {anyFilter && (
          <button type="button" className="btn-ghost btn-sm" onClick={clearFilters}>
            Clear filters
          </button>
        )}
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
                <div className="project-card-title">
                  <Link to={`/project/${p.id}`} className="project-card-name">{p.name}</Link>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={(e) => handleCopyLink(e, p)}
                    title="Copy project link"
                  >
                    {copiedId === p.id ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
                {p.description && <p className="project-card-desc">{p.description}</p>}
                <div className="project-card-meta">
                  <span className={`badge badge-${p.status === 'active' ? 'done' : p.status === 'on_hold' ? 'medium' : p.status === 'completed' ? 'done' : 'low'}`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                  <span className={`badge badge-${p.priority}`}>{p.priority}</span>
                  {p.owner_name && <span className="meta-owner">{p.owner_name}</span>}
                </div>
                {projectTagNames(p).length > 0 && (
                  <div className="project-card-tags">
                    {projectTagNames(p).map((t, i) => (
                      <span key={i} className="label-badge">{t}</span>
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
                  {p.taskCounts?.overdue > 0 && (
                    <span className="count-item overdue">
                      <span className="count-dot overdue" /> {p.taskCounts.overdue} Overdue
                    </span>
                  )}
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
