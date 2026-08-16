import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import ProjectModal from './ProjectModal';
import './Layout.css';

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconProjects = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconInbox = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const IconDocs = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const IconGoals = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function Layout() {
  const { user, logout, apiFetch, hasRole } = useAuth();
  const {
    projects, projectsLoading, refreshProjects,
    showProjectModal, openNewProjectModal, closeProjectModal,
    editingProject, setEditingProject,
    view, setView, breadcrumb, users
  } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const isHome = location.pathname === '/';
  const isProjectPage = location.pathname.startsWith('/project/');
  const currentProjectId = isProjectPage ? location.pathname.split('/')[2] : null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProject = async (data) => {
    try {
      if (editingProject) {
        await apiFetch(`/projects/${editingProject.id}`, { method: 'PATCH', body: JSON.stringify(data) });
      } else {
        await apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) });
      }
      closeProjectModal();
      refreshProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredProjects = searchQuery
    ? projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
        setSearchResults(data);
        setSearchOpen(true);
      } catch (err) {
        console.error(err);
        setSearchResults(null);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, apiFetch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSearchSelect = (path) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    navigate(path);
  };

  const hasSearchResults = searchResults &&
    (searchResults.projects?.length || searchResults.tasks?.length || searchResults.comments?.length);

  return (
    <div className="app-shell">
      {/* Column 1: Icon Rail */}
      {!railCollapsed && (
        <nav className="icon-rail">
          <Link to="/" className={`icon-rail-btn ${isHome ? 'active' : ''}`} title="Dashboard">
            <IconDashboard />
          </Link>
          <Link to="/projects" className={`icon-rail-btn ${location.pathname === '/projects' ? 'active' : ''}`} title="Projects">
            <IconProjects />
          </Link>
          <button className="icon-rail-btn" title="Inbox">
            <IconInbox />
          </button>
          <button className="icon-rail-btn" title="Docs">
            <IconDocs />
          </button>
          <button className="icon-rail-btn" title="Goals">
            <IconGoals />
          </button>
          {hasRole('admin') && (
            <Link to="/users" className={`icon-rail-btn ${location.pathname === '/users' ? 'active' : ''}`} title="Members">
              <IconUsers />
            </Link>
          )}
          <div className="icon-rail-spacer" />
          <button className="icon-rail-btn" title="Settings">
            <IconSettings />
          </button>
          <button
            className="icon-rail-btn icon-rail-collapse"
            title="Collapse sidebar"
            onClick={() => setRailCollapsed(true)}
          >
            <IconChevronLeft />
          </button>
        </nav>
      )}

      {railCollapsed && (
        <div className="icon-rail" style={{ width: 16, padding: '0.75rem 0' }}>
          <button
            className="icon-rail-btn"
            title="Expand sidebar"
            onClick={() => setRailCollapsed(false)}
            style={{ width: 16, height: 40 }}
          >
            <IconChevronRight />
          </button>
        </div>
      )}

      {/* Column 2: Project Nav */}
      <aside className="project-nav">
        <div className="project-nav-header">
          <span className="project-nav-workspace">Glance</span>
          {!hasRole('viewer') && (
            <button className="project-nav-new-btn" onClick={openNewProjectModal} title="New Project">
              <IconPlus /> New
            </button>
          )}
        </div>

        <div className="project-nav-section-label">
          <span>Projects</span>
          <span className="project-nav-section-count">{projects.length}</span>
        </div>

        <div className="project-nav-list">
          {projectsLoading ? (
            <div className="loading" style={{ padding: '1rem' }}><div className="spinner" /></div>
          ) : filteredProjects.length === 0 ? (
            <div className="empty" style={{ padding: '1rem', fontSize: '0.75rem' }}>
              {searchQuery ? 'No matching projects' : 'No projects yet'}
            </div>
          ) : (
            filteredProjects.map(p => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className={`project-nav-item ${currentProjectId === String(p.id) ? 'active' : ''}`}
              >
                <span className="project-nav-dot" style={{ background: p.color }} />
                <span className="project-nav-name">{p.name}</span>
              </Link>
            ))
          )}
        </div>

        {!hasRole('viewer') && (
          <div className="project-nav-footer">
            <button className="project-nav-add-link" onClick={openNewProjectModal}>
              <IconPlus /> New Project
            </button>
          </div>
        )}
      </aside>

      {/* Column 3+4: Main Area (Top Bar + Content) */}
      <div className="main-area">
        <header className="top-bar">
          <div className="top-bar-left">
            <span className="breadcrumb">
              {breadcrumb || (isHome ? 'Dashboard' : 'Glance')}
            </span>
          </div>

          <div className="top-bar-center">
            <div style={{ position: 'relative', width: '100%', maxWidth: 300 }} ref={searchRef}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                <IconSearch />
              </span>
              <input
                type="text"
                className="search-input"
                placeholder="Search projects, tasks, comments..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (hasSearchResults) setSearchOpen(true); }}
                style={{ paddingLeft: '1.75rem' }}
              />
              {searchOpen && (
                <div className="search-dropdown">
                  {!hasSearchResults ? (
                    <div className="search-empty">No results</div>
                  ) : (
                    <>
                      {searchResults.projects?.length > 0 && (
                        <div className="search-group">
                          <div className="search-group-label">Projects</div>
                          {searchResults.projects.map(p => (
                            <button key={p.id} className="search-item" onClick={() => handleSearchSelect(`/project/${p.id}`)}>
                              <span className="search-dot" style={{ background: p.color }} />
                              <span className="search-item-text">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.tasks?.length > 0 && (
                        <div className="search-group">
                          <div className="search-group-label">Tasks</div>
                          {searchResults.tasks.map(t => (
                            <button key={t.id} className="search-item" onClick={() => handleSearchSelect(`/project/${t.project_id}`)}>
                              <span className="search-item-text">{t.title}</span>
                              <span className="search-item-sub">{t.project_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.comments?.length > 0 && (
                        <div className="search-group">
                          <div className="search-group-label">Comments</div>
                          {searchResults.comments.map(c => (
                            <button key={c.id} className="search-item" onClick={() => handleSearchSelect(`/project/${c.project_id}`)}>
                              <span className="search-item-text">{c.body}</span>
                              <span className="search-item-sub">{c.task_title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            {isProjectPage && (
              <div className="view-toggle-top">
                <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>Board</button>
                <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
                <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Timeline</button>
              </div>
            )}
          </div>

          <div className="top-bar-right">
            <div className="user-menu">
              <button
                className="user-avatar"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={user?.name}
              >
                {getInitials(user?.name)}
              </button>
              {showUserMenu && (
                <div className="user-dropdown" onMouseLeave={() => setShowUserMenu(false)}>
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{user?.name}</div>
                    <div className="user-dropdown-email">{user?.email}</div>
                  </div>
                  <button className="user-dropdown-item danger" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content-area">
          <Outlet />
        </main>
      </div>

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          users={users}
          onClose={closeProjectModal}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}
