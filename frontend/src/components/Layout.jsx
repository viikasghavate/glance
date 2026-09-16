import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import ProjectModal from './ProjectModal';
import AIChatPanel from './AIChatPanel';
import './Layout.css';

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
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

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

function relativeTime(sqliteUtc) {
  if (!sqliteUtc) return '';
  const ts = sqliteUtc.replace(' ', 'T') + 'Z';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 52) return `${wk}w`;
  return `${Math.floor(wk / 52)}y`;
}

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

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" />
  </svg>
);

const NAV_STORAGE_KEY = 'glance_nav_apps';
const DEFAULT_APPS = { Projects: true, Workspace: true, People: false, Admin: false };

function loadExpandedApps() {
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPS };
    const parsed = JSON.parse(raw);
    const result = { ...DEFAULT_APPS };
    for (const key of Object.keys(DEFAULT_APPS)) {
      if (typeof parsed[key] === 'boolean') result[key] = parsed[key];
    }
    return result;
  } catch {
    return { ...DEFAULT_APPS };
  }
}

export default function Layout() {
  const { user, logout, apiFetch, hasRole } = useAuth();
  const {
    refreshProjects,
    showProjectModal, openNewProjectModal, closeProjectModal,
    editingProject, setEditingProject,
    view, setView, breadcrumb, users,
    portfolios, programs,
    theme, toggleTheme
  } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [expandedApps, setExpandedApps] = useState(loadExpandedApps);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(expandedApps));
    } catch {
      /* ignore quota / storage errors */
    }
  }, [expandedApps]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);
  const searchOpenRef = useRef(searchOpen);
  const hasSearchResultsRef = useRef(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    let active = true;
    apiFetch('/notifications/unread-count')
      .then(d => { if (active) setUnreadCount(d.count || 0); })
      .catch(() => {});
    apiFetch('/notifications')
      .then(list => { if (active) setNotifications(Array.isArray(list) ? list.slice(0, 20) : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [apiFetch]);

  const toggleNotifications = async () => {
    if (notifOpen) {
      setNotifOpen(false);
      return;
    }
    setNotifOpen(true);
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (n) => {
    let payload = n.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    const projectId = payload && payload.project_id;
    const taskId = payload && payload.task_id;
    if (!n.read) {
      try { await apiFetch(`/notifications/${n.id}/read`, { method: 'POST' }); } catch (err) { console.error(err); }
    }
    setNotifOpen(false);
    if (projectId != null && taskId != null) {
      navigate(`/project/${projectId}?task=${taskId}`);
    } else if (projectId != null) {
      navigate(`/project/${projectId}`);
    }
  };

  const isHome = location.pathname === '/';
  const isProjectPage = location.pathname.startsWith('/project/');

  const toggleApp = (app) => {
    setExpandedApps(prev => ({ ...prev, [app]: !prev[app] }));
  };

  const isModuleActive = (to) => {
    if (to === '/') return isHome;
    return location.pathname.startsWith(to);
  };

  const navApps = [
    {
      name: 'Workspace',
      modules: [
        { label: 'Dashboard', to: '/' },
        { label: 'Activity', to: '/activity' },
        { label: 'Programs', to: '/ports' },
        { label: 'Portfolios', to: '/ports' },
      ],
    },
    {
      name: 'Projects',
      modules: [
        { label: 'All Projects', to: '/projects' },
        { label: 'My Tasks', to: '/mytasks' },
        { label: 'Add Project', to: '/projects', action: openNewProjectModal },
      ],
    },
    {
      name: 'People',
      modules: [
        { label: 'Members', to: '/users' },
        { label: 'Skills', to: '/skills' },
      ],
    },
    {
      name: 'Admin',
      adminOnly: true,
      modules: [
        { label: 'Settings', to: '/settings' },
      ],
    },
  ];

  const renderModule = (mod) => {
    const active = isModuleActive(mod.to);
    const content = (
      <>
        <span className="nav-module-dot" />
        <span className="project-nav-name">{mod.label}</span>
      </>
    );
    const className = `project-nav-item nav-module ${active ? 'active' : ''}`;
    if (mod.action) {
      return (
        <button key={mod.label} className={className} onClick={mod.action}>
          {content}
        </button>
      );
    }
    return (
      <Link key={mod.label} to={mod.to} className={className}>
        {content}
      </Link>
    );
  };

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
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (hasSearchResultsRef.current) setSearchOpen(true);
        return;
      }
      if (e.key === '/' && !isTextEntryTarget(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (hasSearchResultsRef.current) setSearchOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (searchOpenRef.current) {
          setSearchOpen(false);
        } else if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    searchOpenRef.current = searchOpen;
  }, [searchOpen]);

  const hasSearchResults = searchResults &&
    (searchResults.projects?.length || searchResults.tasks?.length || searchResults.comments?.length);

  useEffect(() => {
    hasSearchResultsRef.current = hasSearchResults;
  }, [hasSearchResults]);

  const handleSearchSelect = (path) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    navigate(path);
  };

  const isTextEntryTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  };

  return (
    <div className="app-shell">
      {/* Column 1: Icon Rail */}
      {!railCollapsed && (
        <nav className="icon-rail">
          <button className="icon-rail-btn" onClick={toggleNotifications} title="Notifications">
            <IconBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          <button className="icon-rail-btn" onClick={toggleTheme} title={theme === 'neon' ? 'Switch to light' : 'Switch to dark'}>
            {theme === 'neon' ? <IconMoon /> : <IconSun />}
          </button>
          <div className="icon-rail-spacer" />
          <button
            className="icon-rail-btn"
            title="AI Assistant"
            onClick={() => window.dispatchEvent(new CustomEvent('glance:open-ai'))}
          >
            <IconSparkle />
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
          <span>Apps</span>
        </div>

        <div className="project-nav-list">
          {navApps.map(app => {
            if (app.adminOnly && !hasRole('admin')) return null;
            const open = !!expandedApps[app.name];
            return (
              <div key={app.name} className="nav-app">
                <button className="nav-app-header" onClick={() => toggleApp(app.name)}>
                  <span className={`nav-app-caret ${open ? 'open' : ''}`}>
                    <IconChevronRight />
                  </span>
                  <span className="nav-app-title">{app.name}</span>
                  <span className="project-nav-section-count">{app.modules.length}</span>
                </button>
                {open && (
                  <div className="nav-app-body">
                    {app.modules.map(renderModule)}
                  </div>
                )}
              </div>
            );
          })}
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
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Search projects, tasks, comments..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (hasSearchResults) setSearchOpen(true); }}
                style={{ paddingLeft: '1.75rem' }}
              />
              {!searchQuery && (
                <span className="search-kbd-hint"><kbd>⌘K</kbd></span>
              )}
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
                            <button key={t.id} className="search-item" onClick={() => handleSearchSelect(`/project/${t.project_id}?task=${t.id}`)}>
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
                            <button key={c.id} className="search-item" onClick={() => handleSearchSelect(`/project/${c.project_id}?task=${c.task_id}`)}>
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
            <div className="top-bar-clock">
              <span className="top-bar-clock-date">
                {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="top-bar-clock-time">
                {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
            <div className="notif-menu" ref={notifRef}>
              <button
                className="notif-bell"
                onClick={toggleNotifications}
                title="Notifications"
              >
                <IconBell />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        className={`notif-item ${!n.read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <span className="notif-dot" />
                        <span className="notif-content">
                          <span className="notif-title">{n.title}</span>
                          <span className="notif-body">{n.body}</span>
                        </span>
                        <span className="notif-time">{relativeTime(n.created_at)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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
          portfolios={portfolios}
          programs={programs}
          onClose={closeProjectModal}
          onSave={handleSaveProject}
        />
      )}

      <AIChatPanel />
    </div>
  );
}
