import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './TaskModal.css';

function getDescendantIds(taskId, allTasks) {
  const ids = new Set();
  const queue = [taskId];
  while (queue.length > 0) {
    const current = queue.shift();
    const children = allTasks.filter(t => t.parent_id === current);
    for (const child of children) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return ids;
}

export default function TaskModal({ task, users, projectId, tasks, sprints, milestones, projects, onClose, onSave, apiFetch }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '');
  const [labels, setLabels] = useState(task?.labels || '');
  const [startDate, setStartDate] = useState(task?.start_date || '');
  const [startTime, setStartTime] = useState(task?.start_time || '');
  const [endTime, setEndTime] = useState(task?.end_time || '');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimated_hours ?? '');
  const [timeSpent, setTimeSpent] = useState(task?.time_spent ?? 0);
  const [reporterId, setReporterId] = useState(task?.reporter_id || '');
  const [archived, setArchived] = useState(!!task?.archived);
  const [parentId, setParentId] = useState(task?.parent_id || '');
  const [recurrence, setRecurrence] = useState(task?.recurrence || 'none');
  const [recurrenceEnd, setRecurrenceEnd] = useState(task?.recurrence_end || '');
  const [sprintId, setSprintId] = useState(task?.sprint_id || '');
  const [milestoneId, setMilestoneId] = useState(task?.milestone_id || '');
  const [position, setPosition] = useState(task?.position ?? '');
  const [projectIdState, setProjectIdState] = useState(task?.project_id || projectId || '');
  const [submitting, setSubmitting] = useState(false);

  const [checklist, setChecklist] = useState([]);
  const [checklistText, setChecklistText] = useState('');
  const [loadingChecklist, setLoadingChecklist] = useState(!!task);

  const [blockedBy, setBlockedBy] = useState(task?.blockedBy || []);
  const [dependsOnId, setDependsOnId] = useState('');

  const [watchers, setWatchers] = useState([]);
  const [loadingWatchers, setLoadingWatchers] = useState(!!task);

  const [sprintOptions, setSprintOptions] = useState(sprints || []);
  const [milestoneOptions, setMilestoneOptions] = useState(milestones || []);

  const isEditing = !!task;

  useEffect(() => {
    if (!isEditing) return;
    apiFetch(`/tasks/${task.id}/checklist`)
      .then(setChecklist)
      .catch(console.error)
      .finally(() => setLoadingChecklist(false));
    apiFetch(`/tasks/${task.id}/watchers`)
      .then(setWatchers)
      .catch(console.error)
      .finally(() => setLoadingWatchers(false));
  }, [task?.id]);

  useEffect(() => {
    if (!projectIdState) return;
    const pid = Number(projectIdState);
    if (pid === Number(projectId)) {
      setSprintOptions(sprints || []);
      setMilestoneOptions(milestones || []);
      return;
    }
    apiFetch(`/projects/${pid}/sprints`).then(setSprintOptions).catch(() => setSprintOptions([]));
    apiFetch(`/projects/${pid}/milestones`).then(setMilestoneOptions).catch(() => setMilestoneOptions([]));
  }, [projectIdState]);

  const eligibleParents = useMemo(() => {
    if (!tasks) return [];
    const excludeIds = new Set();
    if (task) {
      excludeIds.add(task.id);
      const descendants = getDescendantIds(task.id, tasks);
      descendants.forEach(id => excludeIds.add(id));
    }
    return tasks.filter(t => !excludeIds.has(t.id) && Number(t.project_id) === Number(projectIdState));
  }, [tasks, task, projectIdState]);

  const eligibleDependencies = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      if (t.id === task?.id) return false;
      if (blockedBy.some(d => d.id === t.id)) return false;
      if (Number(t.project_id) !== Number(projectIdState)) return false;
      return true;
    });
  }, [tasks, task, blockedBy, projectIdState]);

  const handleProjectChange = (e) => {
    const val = e.target.value;
    setProjectIdState(val);
    setSprintId('');
    setMilestoneId('');
    setParentId('');
  };

  const handleAddChecklistItem = (e) => {
    e.preventDefault();
    if (!checklistText.trim()) return;
    if (isEditing) {
      apiFetch(`/tasks/${task.id}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ text: checklistText.trim() })
      }).then(item => {
        setChecklist(prev => [...prev, item]);
        setChecklistText('');
      }).catch(console.error);
    } else {
      setChecklist(prev => [...prev, { id: `local-${Date.now()}`, text: checklistText.trim(), completed: 0 }]);
      setChecklistText('');
    }
  };

  const handleToggleChecklistItem = (item) => {
    if (isEditing) {
      apiFetch(`/tasks/checklist/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: item.completed ? 0 : 1 })
      }).then(updated => {
        setChecklist(prev => prev.map(i => i.id === updated.id ? updated : i));
      }).catch(console.error);
    } else {
      setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, completed: i.completed ? 0 : 1 } : i));
    }
  };

  const handleDeleteChecklistItem = (item) => {
    if (isEditing) {
      apiFetch(`/tasks/checklist/${item.id}`, { method: 'DELETE' })
        .then(() => setChecklist(prev => prev.filter(i => i.id !== item.id)))
        .catch(console.error);
    } else {
      setChecklist(prev => prev.filter(i => i.id !== item.id));
    }
  };

  const handleAddDependency = () => {
    if (!dependsOnId) return;
    apiFetch(`/tasks/${task.id}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ depends_on_id: Number(dependsOnId) })
    }).then(updated => {
      setBlockedBy(updated.blockedBy || []);
      setDependsOnId('');
    }).catch(console.error);
  };

  const handleRemoveDependency = (depId) => {
    apiFetch(`/tasks/${task.id}/dependencies/${depId}`, { method: 'DELETE' })
      .then(updated => setBlockedBy(updated.blockedBy || []))
      .catch(console.error);
  };

  const isWatching = watchers.some(w => w.id === user?.id);

  const handleToggleWatch = () => {
    if (isWatching) {
      apiFetch(`/tasks/${task.id}/watchers`, { method: 'DELETE' })
        .then(setWatchers)
        .catch(console.error);
    } else {
      apiFetch(`/tasks/${task.id}/watchers`, { method: 'POST' })
        .then(setWatchers)
        .catch(console.error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const saved = await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        labels: labels.trim(),
        start_date: startDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        estimated_hours: estimatedHours !== '' ? Number(estimatedHours) : null,
        time_spent: Number(timeSpent),
        reporter_id: reporterId ? Number(reporterId) : null,
        archived: archived ? 1 : 0,
        parent_id: parentId ? Number(parentId) : null,
        recurrence,
        recurrence_end: recurrenceEnd || null,
        sprint_id: sprintId ? Number(sprintId) : null,
        milestone_id: milestoneId ? Number(milestoneId) : null,
        position: position !== '' ? Number(position) : null,
        project_id: projectIdState ? Number(projectIdState) : null
      });

      if (!isEditing && saved && saved.id) {
        for (const item of checklist) {
          await apiFetch(`/tasks/${saved.id}/checklist`, {
            method: 'POST',
            body: JSON.stringify({ text: item.text })
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const projectList = projects || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-form-modal" onClick={e => e.stopPropagation()}>
        <h2>{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <fieldset className="task-form-section">
            <legend>General</legend>
            <div className="form-group">
              <label htmlFor="ttitle">Title</label>
              <input id="ttitle" type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="tdesc">Description</label>
              <textarea id="tdesc" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tstatus">Status</label>
                <select id="tstatus" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tpriority">Priority</label>
                <select id="tpriority" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="tlabels">Labels (comma-separated)</label>
              <input id="tlabels" type="text" value={labels} onChange={e => setLabels(e.target.value)} placeholder="bug, frontend, urgent" />
            </div>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Planning</legend>
            <div className="form-group">
              <label htmlFor="tproject">Project</label>
              <select id="tproject" value={projectIdState} onChange={handleProjectChange}>
                {projectList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tsprint">Sprint</label>
                <select id="tsprint" value={sprintId} onChange={e => setSprintId(e.target.value)}>
                  <option value="">None</option>
                  {(sprintOptions || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tmilestone">Milestone</label>
                <select id="tmilestone" value={milestoneId} onChange={e => setMilestoneId(e.target.value)}>
                  <option value="">None</option>
                  {(milestoneOptions || []).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tparent">Parent Task</label>
                <select id="tparent" value={parentId} onChange={e => setParentId(e.target.value)}>
                  <option value="">None (top-level task)</option>
                  {eligibleParents.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tposition">Position</label>
                <input id="tposition" type="number" step="1" min="0" value={position} onChange={e => setPosition(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Schedule</legend>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tstart">Start Date</label>
                <input id="tstart" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="tstarttime">Start Time</label>
                <input id="tstarttime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tdue">Due Date</label>
                <input id="tdue" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="tendtime">End Time</label>
                <input id="tendtime" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Assignment</legend>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tassignee">Assignee</label>
                <select id="tassignee" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="treporter">Reporter</label>
                <select id="treporter" value={reporterId} onChange={e => setReporterId(e.target.value)}>
                  <option value="">None</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />
                Archived
              </label>
            </div>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Estimation</legend>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="testhours">Estimated Hours</label>
                <input id="testhours" type="number" step="0.5" min="0" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="ttimespent">Time Spent (hours)</label>
                <input id="ttimespent" type="number" step="0.5" min="0" value={timeSpent} onChange={e => setTimeSpent(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Recurrence</legend>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="trecurrence">Recurrence</label>
                <select id="trecurrence" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="trecurrenceend">Recurrence End</label>
                <input id="trecurrenceend" type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Subtasks (Checklist)</legend>
            {loadingChecklist ? (
              <div className="loading"><div className="spinner" /></div>
            ) : checklist.length === 0 ? (
              <p className="empty">No checklist items.</p>
            ) : (
              <div className="checklist-list">
                {checklist.map(item => (
                  <div key={item.id} className={`checklist-item ${item.completed ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!item.completed}
                      onChange={() => handleToggleChecklistItem(item)}
                    />
                    <span className="checklist-item-text">{item.text}</span>
                    <button className="btn-ghost btn-sm" onClick={() => handleDeleteChecklistItem(item)} title="Delete">&times;</button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleAddChecklistItem} className="checklist-form">
              <input
                type="text"
                value={checklistText}
                onChange={e => setChecklistText(e.target.value)}
                placeholder="Add checklist item..."
              />
              <button type="submit" className="btn-primary btn-sm" disabled={!checklistText.trim()}>Add</button>
            </form>
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Dependencies (Blocked by)</legend>
            {!isEditing ? (
              <p className="empty">Available after the task is created.</p>
            ) : blockedBy.length === 0 ? (
              <p className="empty">No dependencies.</p>
            ) : (
              <div className="subtask-list">
                {blockedBy.map(d => (
                  <div key={d.id} className="subtask-item">
                    <span className={`badge badge-${d.status}`}>{d.status}</span>
                    <span className="subtask-item-title">{d.title}</span>
                    <button className="btn-ghost btn-sm" onClick={() => handleRemoveDependency(d.id)}>&times;</button>
                  </div>
                ))}
              </div>
            )}
            {isEditing && (
              <div className="dependency-add">
                <select value={dependsOnId} onChange={e => setDependsOnId(e.target.value)}>
                  <option value="">Add dependency...</option>
                  {eligibleDependencies.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <button className="btn-primary btn-sm" onClick={handleAddDependency} disabled={!dependsOnId}>Add</button>
              </div>
            )}
          </fieldset>

          <fieldset className="task-form-section">
            <legend>Watchers</legend>
            {!isEditing ? (
              <p className="empty">Available after the task is created.</p>
            ) : (
              <>
                {loadingWatchers ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : watchers.length === 0 ? (
                  <p className="empty">No watchers.</p>
                ) : (
                  <div className="subtask-list">
                    {watchers.map(w => (
                      <div key={w.id} className="subtask-item">
                        <span className="subtask-item-title">{w.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="btn-ghost btn-sm" onClick={handleToggleWatch}>
                  {isWatching ? 'Unwatch this task' : 'Watch this task'}
                </button>
              </>
            )}
          </fieldset>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
