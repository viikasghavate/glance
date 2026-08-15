import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css';

const statusMeta = {
  todo: { label: 'To Do', color: 'var(--cyan)' },
  in_progress: { label: 'In Progress', color: 'var(--warning)' },
  done: { label: 'Done', color: 'var(--success)' }
};

const priorityMeta = {
  high: { label: 'High', color: 'var(--danger)' },
  medium: { label: 'Medium', color: 'var(--warning)' },
  low: { label: 'Low', color: 'var(--success)' }
};

const IconProjects = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconTasks = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const IconTodo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const IconInProgress = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconDone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconOverdue = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconMembers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Donut({ data, meta }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map(d => {
    const frac = total > 0 ? d.count / total : 0;
    const seg = { ...d, frac, dash: frac * c, offset };
    offset += frac * c;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 100 100" className="donut">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="12" />
        {segments.map(s => (
          <circle
            key={s.status}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={meta[s.status]?.color || 'var(--cyan)'}
            strokeWidth="12"
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 50 50)"
          />
        ))}
      </svg>
      <div className="donut-center">
        <div className="donut-total">{total}</div>
        <div className="donut-caption">Tasks</div>
      </div>
      <div className="donut-legend">
        {data.map(d => (
          <div key={d.status} className="legend-item">
            <span className="legend-dot" style={{ background: meta[d.status]?.color }} />
            <span className="legend-label">{meta[d.status]?.label || d.status}</span>
            <span className="legend-count">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityBars({ data, meta }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="bar-list">
      {data.map(d => (
        <div key={d.priority} className="bar-row">
          <span className="bar-label">{meta[d.priority]?.label || d.priority}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.count / max) * 100}%`, background: meta[d.priority]?.color }}
            />
          </div>
          <span className="bar-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function WorkloadBars({ data }) {
  const max = Math.max(1, ...data.map(d => d.tasksAssigned));
  return (
    <div className="bar-list">
      {data.map(d => (
        <div key={d.user_id} className="bar-row">
          <span className="bar-label">{d.name}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.tasksAssigned / max) * 100}%`, background: 'linear-gradient(90deg, var(--cyan), var(--violet))' }}
            />
          </div>
          <span className="bar-count">{d.tasksAssigned}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/analytics')
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-grid">
        <StatCard icon={<IconProjects />} label="Total Projects" value={summary.projects} accent="var(--violet)" />
        <StatCard icon={<IconTasks />} label="Total Tasks" value={summary.tasks} accent="var(--cyan)" />
        <StatCard icon={<IconTodo />} label="To Do" value={summary.tasksTodo} accent="var(--cyan)" />
        <StatCard icon={<IconInProgress />} label="In Progress" value={summary.tasksInProgress} accent="var(--warning)" />
        <StatCard icon={<IconDone />} label="Done" value={summary.tasksDone} accent="var(--success)" />
        <StatCard icon={<IconOverdue />} label="Overdue" value={summary.overdueTasks} accent="var(--danger)" />
        <StatCard icon={<IconMembers />} label="Members" value={summary.members} accent="var(--violet)" />
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <h2 className="panel-title">Tasks by Status</h2>
          <Donut data={data.tasksByStatus} meta={statusMeta} />
        </div>

        <div className="panel">
          <h2 className="panel-title">Tasks by Priority</h2>
          <PriorityBars data={data.tasksByPriority} meta={priorityMeta} />
        </div>

        <div className="panel">
          <h2 className="panel-title">Workload by Member</h2>
          <WorkloadBars data={data.workloadByMember} />
        </div>

        <div className="panel">
          <h2 className="panel-title">Project Progress</h2>
          <div className="project-progress-list">
            {data.projectProgress.length === 0 ? (
              <div className="empty">No projects yet</div>
            ) : (
              data.projectProgress.map(p => (
                <Link key={p.project_id} to={`/project/${p.project_id}`} className="project-progress-row">
                  <div className="project-progress-head">
                    <span className="project-progress-name">{p.name}</span>
                    <span className="project-progress-pct">{p.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                  </div>
                  <div className="project-progress-meta">{p.done}/{p.tasks} done</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid-bottom">
        <div className="panel">
          <h2 className="panel-title panel-title-danger">Overdue Tasks</h2>
          <div className="task-list">
            {data.overdueTasks.length === 0 ? (
              <div className="empty">No overdue tasks</div>
            ) : (
              data.overdueTasks.map(t => (
                <Link key={t.id} to={`/project/${t.project_id}`} className="task-row overdue">
                  <div className="task-row-title">{t.title}</div>
                  <div className="task-row-meta">
                    <span className="task-row-project">{t.project_name}</span>
                    {t.assignee_name && <span className="task-row-assignee">{t.assignee_name}</span>}
                    <span className="task-row-due">{t.due_date}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Recent Activity</h2>
          <div className="task-list">
            {data.recentActivity.length === 0 ? (
              <div className="empty">No recent activity</div>
            ) : (
              data.recentActivity.map(t => (
                <Link key={t.id} to={`/project/${t.project_id}`} className="task-row">
                  <div className="task-row-title">{t.title}</div>
                  <div className="task-row-meta">
                    <span className="task-row-project">{t.project_name}</span>
                    <span className={`badge badge-${t.status}`}>{statusMeta[t.status]?.label || t.status}</span>
                    <span className="task-row-due">{t.updated_at}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
