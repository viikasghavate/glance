import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import KanbanBoard from '../components/KanbanBoard';
import TaskList from '../components/TaskList';
import TimelineView from '../components/TimelineView';
import TaskModal from '../components/TaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import SprintSection from '../components/SprintSection';
import MilestoneSection from '../components/MilestoneSection';
import './ProjectDetailPage.css';

const statusLabels = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived'
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { apiFetch, hasRole } = useAuth();
  const { view, setBreadcrumb, projects } = useUI();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    try {
      const [projData, taskData, userData, sprintData, milestoneData] = await Promise.all([
        apiFetch(`/projects/${id}`).catch(() => null),
        apiFetch(`/tasks/project/${id}`),
        apiFetch('/users'),
        apiFetch(`/projects/${id}/sprints`).catch(() => []),
        apiFetch(`/projects/${id}/milestones`).catch(() => [])
      ]);
      if (!projData) { navigate('/'); return; }
      setProject(projData);
      setBreadcrumb(`Glance / ${projData.name}`);
      setTasks(taskData);
      setUsers(userData);
      setSprints(sprintData);
      setMilestones(milestoneData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    if (loading) return;
    const taskId = searchParams.get('task');
    if (!taskId) return;
    const found = tasks.find(t => String(t.id) === String(taskId));
    if (found) {
      setSelectedTask(found);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, tasks, loading, setSearchParams]);

  useEffect(() => {
    return () => setBreadcrumb('');
  }, []);

  const handleTaskSave = async (data) => {
    let saved;
    if (editingTask) {
      saved = await apiFetch(`/tasks/${editingTask.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      saved = await apiFetch(`/tasks/project/${id}`, { method: 'POST', body: JSON.stringify(data) });
    }
    setShowTaskModal(false);
    setEditingTask(null);
    fetchData();
    return saved;
  };

  const handleTaskDelete = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
    setSelectedTask(null);
    fetchData();
  };

  const handleReorder = async (taskId, status, position) => {
    const updated = await apiFetch(`/tasks/${taskId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ status, position })
    });
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    fetchData();
  };

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${id}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        alert('Export failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed.');
    }
  };

  const handleTaskUpdate = async (taskId, data) => {
    const updated = await apiFetch(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) });
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(updated);
    }
  };

  const handleDuplicated = async (updated) => {
    setSelectedTask(null);
    fetchData();
  };

  const handleCopyLink = async () => {
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
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      fallbackCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!project) return null;

  const visibleTasks = showArchived ? tasks : tasks.filter(t => !t.archived);

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: '0.5rem' }}>
            &larr; Back to Projects
          </button>
          <h1>{project.name}</h1>
          {project.description && <p className="project-desc">{project.description}</p>}
          <div className="project-detail-meta">
            <span className={`badge badge-${project.status === 'active' ? 'done' : project.status === 'on_hold' ? 'medium' : project.status === 'completed' ? 'done' : 'low'}`}>
              {statusLabels[project.status] || project.status}
            </span>
            <span className={`badge badge-${project.priority}`}>{project.priority}</span>
            {project.owner_name && <span className="meta-item">Owner: {project.owner_name}</span>}
            <div className="progress-bar-inline">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${project.progress || 0}%` }} />
              </div>
              <span className="progress-text">{project.progress || 0}%</span>
            </div>
          </div>
        </div>
        <div className="view-actions">
          <button className="btn-ghost btn-sm" onClick={handleCopyLink} title="Copy project link">
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button className="btn-ghost" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button
            className={`btn-ghost btn-sm ${showArchived ? 'btn-archived-active' : ''}`}
            onClick={() => setShowArchived(s => !s)}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          {!hasRole('viewer') && (
            <button className="btn-primary" onClick={() => { setEditingTask(null); setShowTaskModal(true); }}>
              + New Task
            </button>
          )}
        </div>
      </div>

      {view === 'board' && (
        <KanbanBoard
          tasks={visibleTasks}
          users={users}
          onReorder={handleReorder}
          onTaskClick={setSelectedTask}
          onEditTask={(task) => { setEditingTask(task); setShowTaskModal(true); }}
          readOnly={hasRole('viewer')}
        />
      )}
      {view === 'list' && (
        <TaskList
          tasks={visibleTasks}
          users={users}
          onTaskClick={setSelectedTask}
          onStatusChange={(taskId, status) => handleTaskUpdate(taskId, { status })}
          onReorder={handleReorder}
          readOnly={hasRole('viewer')}
        />
      )}
      {view === 'timeline' && (
        <TimelineView
          tasks={visibleTasks}
          users={users}
          onTaskClick={setSelectedTask}
        />
      )}

      <div className="sprint-milestone-grid">
        <SprintSection
          projectId={id}
          sprints={sprints}
          onRefresh={fetchData}
          apiFetch={apiFetch}
          readOnly={hasRole('viewer')}
        />
        <MilestoneSection
          projectId={id}
          milestones={milestones}
          onRefresh={fetchData}
          apiFetch={apiFetch}
          readOnly={hasRole('viewer')}
        />
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          users={users}
          projectId={id}
          tasks={tasks}
          sprints={sprints}
          milestones={milestones}
          projects={projects}
          apiFetch={apiFetch}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={handleTaskSave}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          tasks={tasks}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={(data) => handleTaskUpdate(selectedTask.id, data)}
          onDelete={() => handleTaskDelete(selectedTask.id)}
          onDuplicated={handleDuplicated}
          apiFetch={apiFetch}
          readOnly={hasRole('viewer')}
        />
      )}
    </div>
  );
}
