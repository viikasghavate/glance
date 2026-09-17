import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './ActivityLogPage.css';

const PAGE_SIZE = 50;

const ACTION_LABELS = {
  'task.created': 'created task',
  'task.updated': 'updated task',
  'task.status_changed': 'moved task',
  'task.assigned': 'assigned task',
  'task.deleted': 'deleted task',
  'task.dependency_added': 'added a dependency to',
  'task.dependency_removed': 'removed a dependency from',
  'task.dependencies_cleared': 'cleared dependencies on',
  'task.duplicated': 'duplicated task',
  'comment.added': 'commented on',
  'comment.deleted': 'deleted a comment on',
  'project.created': 'created project',
  'project.updated': 'updated project',
  'project.deleted': 'deleted project',
  'project.skill_required': 'added a skill requirement to',
  'project.skill_requirement_removed': 'removed a skill requirement from',
  'user.created': 'created user',
  'user.deleted': 'deleted user',
  'user.role_changed': 'changed role of',
  'user.login': 'logged in',
  'user.registered': 'registered',
  'user.password_reset': 'reset password of',
  'user.password_changed_self': 'changed own password',
  'user.updated_self': 'updated own profile',
  'user.skill_set': 'set a skill for',
  'user.skill_removed': 'removed a skill from',
  'user.skill_endorsed': 'endorsed a skill of',
  'user.skill_endorsement_removed': 'removed an endorsement from',
  'skill.created': 'created skill',
  'skill.updated': 'updated skill',
  'skill.deleted': 'deleted skill',
  'milestone.created': 'created milestone',
  'milestone.updated': 'updated milestone',
  'milestone.deleted': 'deleted milestone',
  'sprint.created': 'created sprint',
  'sprint.updated': 'updated sprint',
  'sprint.deleted': 'deleted sprint',
  'portfolio.created': 'created portfolio',
  'portfolio.updated': 'updated portfolio',
  'portfolio.deleted': 'deleted portfolio',
  'program.created': 'created program',
  'program.updated': 'updated program',
  'program.deleted': 'deleted program',
  'ai.chat': 'used AI chat'
};

const ENTITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'task', label: 'Task' },
  { value: 'comment', label: 'Comment' },
  { value: 'project', label: 'Project' },
  { value: 'user', label: 'User' },
  { value: 'skill', label: 'Skill' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'program', label: 'Program' },
  { value: 'auth', label: 'Auth' },
  { value: 'ai', label: 'AI' }
];

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const ts = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const then = new Date(ts + (ts.includes('Z') ? '' : 'Z'));
  if (isNaN(then.getTime())) return '';
  const diff = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diff < 60) return 'just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatActivity(a) {
  const verb = ACTION_LABELS[a.action] || a.action;
  const name = a.entity_name ? `'${a.entity_name}'` : '';
  const user = a.user_name || 'Someone';
  return `${user} ${verb} ${name}`.trim();
}

function formatDetails(details) {
  if (!details) return null;
  let parsed = details;
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch {
      return details;
    }
  }
  if (parsed == null) return null;
  if (typeof parsed === 'object') {
    const pairs = Object.entries(parsed);
    if (pairs.length === 0) return null;
    return pairs
      .map(([k, v]) => {
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `${k}: ${val}`;
      })
      .join('  ·  ');
  }
  return String(parsed);
}

export default function ActivityLogPage() {
  const { apiFetch } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entityType, setEntityType] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const prevEntityRef = useRef('');
  const prevQueryRef = useRef('');
  const prevUserIdRef = useRef('');
  const prevFromRef = useRef('');
  const prevToRef = useRef('');
  const prevProjectRef = useRef('');
  const debounceRef = useRef(null);

  const load = useCallback(async (type, reset) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (type) params.set('entity_type', type);
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (userId) params.set('user_id', userId);
      if (projectId) params.set('project_id', projectId);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const data = await apiFetch(`/activity?${params.toString()}`);
      const list = Array.isArray(data) ? data : [];
      if (reset) {
        setRows(list);
      } else {
        setRows(prev => {
          const seen = new Set(prev.map(r => r.id));
          const next = list.filter(r => !seen.has(r.id));
          return [...prev, ...next];
        });
      }
      setHasMore(list.length === limit);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiFetch, limit, debouncedQuery, userId, fromDate, toDate, projectId]);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    apiFetch('/users').then(data => {
      setUsers(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    apiFetch('/projects').then(data => {
      setProjects(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    const reset = isFirstLoad.current || entityType !== prevEntityRef.current || debouncedQuery !== prevQueryRef.current || userId !== prevUserIdRef.current || fromDate !== prevFromRef.current || toDate !== prevToRef.current || projectId !== prevProjectRef.current;
    isFirstLoad.current = false;
    prevEntityRef.current = entityType;
    prevQueryRef.current = debouncedQuery;
    prevUserIdRef.current = userId;
    prevFromRef.current = fromDate;
    prevToRef.current = toDate;
    prevProjectRef.current = projectId;
    load(entityType, reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, debouncedQuery, limit, userId, fromDate, toDate, projectId]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim() ? query : '');
      setLimit(PAGE_SIZE);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };

  const handleEntityTypeChange = (e) => {
    setLimit(PAGE_SIZE);
    setEntityType(e.target.value);
  };

  const handleUserIdChange = (e) => {
    setLimit(PAGE_SIZE);
    setUserId(e.target.value);
  };

  const handleProjectChange = (e) => {
    setLimit(PAGE_SIZE);
    setProjectId(e.target.value);
  };

  const handleFromDateChange = (e) => {
    setLimit(PAGE_SIZE);
    setFromDate(e.target.value);
  };

  const handleToDateChange = (e) => {
    setLimit(PAGE_SIZE);
    setToDate(e.target.value);
  };

  const handleLoadMore = () => {
    setLimit(prev => Math.min(prev + PAGE_SIZE, 200));
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (entityType) params.set('entity_type', entityType);
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (userId) params.set('user_id', userId);
      if (projectId) params.set('project_id', projectId);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const res = await fetch(`/api/activity/export${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Export failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity-log.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="activity-log">
      <div className="page-header">
        <h1>Activity Log</h1>
      </div>

      <div className="activity-filters">
        <input
          className="activity-filter-input"
          type="text"
          placeholder="Search activity…"
          value={query}
          onChange={handleQueryChange}
        />
        <select
          className="activity-filter-select"
          value={entityType}
          onChange={handleEntityTypeChange}
        >
          {ENTITY_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          className="activity-filter-select"
          value={userId}
          onChange={handleUserIdChange}
        >
          <option value="">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select
          className="activity-filter-select"
          value={projectId}
          onChange={handleProjectChange}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          className="activity-filter-select"
          type="date"
          value={fromDate}
          onChange={handleFromDateChange}
          aria-label="From date"
          title="From date"
        />
        <input
          className="activity-filter-select"
          type="date"
          value={toDate}
          onChange={handleToDateChange}
          aria-label="To date"
          title="To date"
        />
        <button
          className="btn-ghost"
          onClick={handleExportCsv}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="panel activity-empty">No activity yet</div>
      ) : (
        <>
          <div className="activity-list">
            {rows.map(a => (
              <div key={a.id} className="activity-row">
                <div className="activity-row-main">
                  <div className="activity-row-text">{formatActivity(a)}</div>
                  <div className="activity-row-meta">
                    <span className={`badge activity-badge activity-badge-${a.entity_type || 'unknown'}`}>
                      {a.entity_type || 'unknown'}
                    </span>
                    {a.user_name && <span className="activity-row-user">{a.user_name}</span>}
                    <span className="activity-row-time">{relativeTime(a.created_at)}</span>
                  </div>
                  {formatDetails(a.details) && (
                    <div className="activity-row-details">{formatDetails(a.details)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="activity-load-more">
              <button className="btn-ghost" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
