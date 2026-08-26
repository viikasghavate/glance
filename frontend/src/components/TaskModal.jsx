import { useState, useMemo } from 'react';

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

export default function TaskModal({ task, users, projectId, tasks, sprints, milestones, onClose, onSave }) {
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
  const [submitting, setSubmitting] = useState(false);

  const eligibleParents = useMemo(() => {
    if (!tasks) return [];
    const excludeIds = new Set();
    if (task) {
      excludeIds.add(task.id);
      const descendants = getDescendantIds(task.id, tasks);
      descendants.forEach(id => excludeIds.add(id));
    }
    return tasks.filter(t => !excludeIds.has(t.id));
  }, [tasks, task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSave({
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
        milestone_id: milestoneId ? Number(milestoneId) : null
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-form-modal" onClick={e => e.stopPropagation()}>
        <h2>{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="ttitle">Title</label>
            <input id="ttitle" type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="tdesc">Description</label>
            <textarea id="tdesc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="tparent">Parent Task</label>
            <select id="tparent" value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">None (top-level task)</option>
              {eligibleParents.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tsprint">Sprint</label>
              <select id="tsprint" value={sprintId} onChange={e => setSprintId(e.target.value)}>
                <option value="">None</option>
                {(sprints || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="tmilestone">Milestone</label>
              <select id="tmilestone" value={milestoneId} onChange={e => setMilestoneId(e.target.value)}>
                <option value="">None</option>
                {(milestones || []).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tdue">Due Date</label>
              <input id="tdue" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="tassignee">Assignee</label>
              <select id="tassignee" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="tlabels">Labels (comma-separated)</label>
            <input id="tlabels" type="text" value={labels} onChange={e => setLabels(e.target.value)} placeholder="bug, frontend, urgent" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tstart">Start Date</label>
              <input id="tstart" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="testhours">Estimated Hours</label>
              <input id="testhours" type="number" step="0.5" min="0" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="tstarttime">Start Time</label>
              <input id="tstarttime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="tendtime">End Time</label>
              <input id="tendtime" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="ttimespent">Time Spent (hours)</label>
              <input id="ttimespent" type="number" step="0.5" min="0" value={timeSpent} onChange={e => setTimeSpent(e.target.value)} />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
