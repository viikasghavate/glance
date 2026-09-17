import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './TimeLogPage.css';

function formatMinutes(m) {
  if (m == null) return '';
  if (m < 60) return `${m} min`;
  return `${(m / 60).toFixed(1)} h`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).replace('T', ' ').slice(0, 16);
}

export default function TimeLogPage() {
  const { apiFetch } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minMinutes, setMinMinutes] = useState('');
  const [exporting, setExporting] = useState(false);

  const anyFilter =
    projectId !== '' ||
    userId !== '' ||
    fromDate !== '' ||
    toDate !== '' ||
    minMinutes !== '';

  const clearFilters = () => {
    setProjectId('');
    setUserId('');
    setFromDate('');
    setToDate('');
    setMinMinutes('');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('project_id', projectId);
      if (userId) params.set('user_id', userId);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (minMinutes !== '') params.set('min_minutes', minMinutes);
      const qs = params.toString();
      const data = await apiFetch(`/time${qs ? `?${qs}` : ''}`);
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, projectId, userId, fromDate, toDate, minMinutes]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch('/projects').then(data => {
      setProjects(Array.isArray(data) ? data : []);
    }).catch(() => {});
    apiFetch('/users').then(data => {
      setUsers(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [apiFetch]);

  const totalMinutes = entries.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0);
  const totalHours = totalMinutes / 60;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (projectId) params.set('project_id', projectId);
      if (userId) params.set('user_id', userId);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (minMinutes !== '') params.set('min_minutes', minMinutes);
      const qs = params.toString();
      const res = await fetch(`/api/time/export${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Export failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'time-entries.csv';
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
    <div className="time-log">
      <div className="page-header">
        <h1>Time Log</h1>
        <button className="btn-ghost" onClick={handleExportCsv} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="time-filters">
        <select className="time-filter-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="time-filter-select" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input
          className="time-filter-select"
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          aria-label="From date"
          title="From date"
        />
        <input
          className="time-filter-select"
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          aria-label="To date"
          title="To date"
        />
        <input
          className="time-filter-select"
          type="number"
          min="0"
          placeholder="Min minutes"
          value={minMinutes}
          onChange={e => setMinMinutes(e.target.value)}
          aria-label="Min minutes"
        />
        {anyFilter && (
          <button type="button" className="btn-ghost" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="panel time-empty">No time logged yet.</div>
      ) : (
        <>
          <div className="time-summary">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {totalHours.toFixed(1)} h total
          </div>
          <div className="time-list">
            {entries.map(e => (
              <div key={e.id} className="time-row">
                <div className="time-row-main">
                  <div className="time-row-task">{e.task_title || 'Untitled task'}</div>
                  <div className="time-row-meta">
                    {e.user_name && <span className="time-row-user">{e.user_name}</span>}
                    {e.project_id != null && (
                      <span className="time-row-project">
                        {projects.find(p => String(p.id) === String(e.project_id))?.name || `#${e.project_id}`}
                      </span>
                    )}
                    <span className="time-row-minutes">{formatMinutes(e.minutes)}</span>
                    <span className="time-row-time">{formatDate(e.created_at)}</span>
                  </div>
                  {e.note && <div className="time-row-note">{e.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
