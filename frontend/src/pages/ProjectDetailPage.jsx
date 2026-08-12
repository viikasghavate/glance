import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import KanbanBoard from '../components/KanbanBoard';
import TaskList from '../components/TaskList';
import TaskModal from '../components/TaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
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
  const { apiFetch } = useAuth();
  const { view, setBreadcrumb } = useUI();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchData = async () => {
    try {
      const [projData, taskData, userData] = await Promise.all([
        apiFetch(`/projects/${id}`).catch(() => null),
        apiFetch(`/tasks/project/${id}`),
        apiFetch('/users')
      ]);
      if (!projData) { navigate('/'); return; }
      setProject(projData);
      setBreadcrumb(`Glance / ${projData.name}`);
      setTasks(taskData);
      setUsers(userData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    return () => setBreadcrumb('');
  }, []);

  const handleTaskSave = async (data) => {
    if (editingTask) {
      await apiFetch(`/tasks/${editingTask.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      await apiFetch(`/tasks/project/${id}`, { method: 'POST', body: JSON.stringify(data) });
    }
    setShowTaskModal(false);
    setEditingTask(null);
    fetchData();
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

  const handleTaskUpdate = async (taskId, data) => {
    const updated = await apiFetch(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) });
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask(updated);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!project) return null;

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
          <button className="btn-primary" onClick={() => { setEditingTask(null); setShowTaskModal(true); }}>
            + New Task
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <KanbanBoard
          tasks={tasks}
          users={users}
          onReorder={handleReorder}
          onTaskClick={setSelectedTask}
          onEditTask={(task) => { setEditingTask(task); setShowTaskModal(true); }}
        />
      ) : (
        <TaskList
          tasks={tasks}
          users={users}
          onTaskClick={setSelectedTask}
          onStatusChange={(taskId, status) => handleTaskUpdate(taskId, { status })}
        />
      )}

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          users={users}
          projectId={id}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={handleTaskSave}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={(data) => handleTaskUpdate(selectedTask.id, data)}
          onDelete={() => handleTaskDelete(selectedTask.id)}
          apiFetch={apiFetch}
        />
      )}
    </div>
  );
}
