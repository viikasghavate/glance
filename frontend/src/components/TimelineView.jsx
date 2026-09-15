import React, { useMemo, useRef, useEffect, useState } from 'react';
import './TimelineView.css';
import { isOverdue, dueInfo } from './overdue';

const todayStr = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const inDueWeek = (due, today) => {
  if (!due) return false;
  if (String(due) < today) return false;
  const end = new Date(today + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  const p = n => String(n).padStart(2, '0');
  const endStr = `${end.getFullYear()}-${p(end.getMonth() + 1)}-${p(end.getDate())}`;
  return String(due) <= endStr;
};

const DAY_MS = 86400000;
const STATUS_COLORS = {
  todo: '#6b7280',
  in_progress: '#f59e0b',
  done: '#22c55e'
};
const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done'
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function TimelineView({ tasks, users, onTaskClick }) {
  const timelineRef = useRef(null);
  const [todayLeft, setTodayLeft] = useState(null);
  const [filterLabel, setFilterLabel] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterSprint, setFilterSprint] = useState('');
  const [filterMilestone, setFilterMilestone] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const priorityIndex = { low: 0, medium: 1, high: 2 };
  const statusIndex = { todo: 0, in_progress: 1, done: 2 };

  const sortCompare = (a, b) => {
    if (sortBy === '') return 0;
    if (sortBy === 'priority') {
      const ai = priorityIndex[a.priority] ?? 0;
      const bi = priorityIndex[b.priority] ?? 0;
      return ai - bi;
    }
    if (sortBy === 'due_date') {
      const ad = a.due_date ? String(a.due_date) : null;
      const bd = b.due_date ? String(b.due_date) : null;
      if (ad === null && bd === null) return 0;
      if (ad === null) return 1;
      if (bd === null) return -1;
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    }
    if (sortBy === 'status') {
      const ai = statusIndex[a.status] ?? 0;
      const bi = statusIndex[b.status] ?? 0;
      return ai - bi;
    }
    if (sortBy === 'assignee') {
      const av = (a.assignee_name || '').toLowerCase();
      const bv = (b.assignee_name || '').toLowerCase();
      return av < bv ? -1 : av > bv ? 1 : 0;
    }
    if (sortBy === 'title') {
      const av = (a.title || '').toLowerCase();
      const bv = (b.title || '').toLowerCase();
      return av < bv ? -1 : av > bv ? 1 : 0;
    }
    return 0;
  };

  const sortedCompare = (a, b) => {
    if (sortBy === 'due_date') {
      const ad = a.due_date ? String(a.due_date) : null;
      const bd = b.due_date ? String(b.due_date) : null;
      if (ad === null && bd === null) return 0;
      if (ad === null) return 1;
      if (bd === null) return -1;
    }
    const result = sortCompare(a, b);
    if (result !== 0) return sortDir === 'desc' ? -result : result;
    return 0;
  };

  const distinctLabels = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => {
      if (t.labels) {
        t.labels.split(',').forEach(l => {
          const v = l.trim();
          if (v) set.add(v);
        });
      }
    });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [tasks]);

  const distinctSprints = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => { if (t.sprint_name) set.add(t.sprint_name); });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [tasks]);

  const distinctMilestones = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => { if (t.milestone_name) set.add(t.milestone_name); });
    return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    if (filterLabel && !(t.labels ? t.labels.split(',').map(l => l.trim().toLowerCase()) : []).includes(filterLabel.toLowerCase())) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && String(t.assignee_id) !== filterAssignee) return false;
    if (filterSprint && t.sprint_name !== filterSprint) return false;
    if (filterMilestone && t.milestone_name !== filterMilestone) return false;
    if (filterDue === 'overdue' && !isOverdue(t.due_date, t.status)) return false;
    if (filterDue === 'today' && !(t.due_date && String(t.due_date) === todayStr())) return false;
    if (filterDue === 'week' && !inDueWeek(t.due_date, todayStr())) return false;
    return true;
  });

  const { groups, timelineStart, timelineEnd, totalDays, dayWidth } = useMemo(() => {
    const tasksWithDates = filteredTasks.filter(t => t.start_date && t.due_date);
    const tasksWithoutDates = filteredTasks.filter(t => !t.start_date || !t.due_date);

    let minDate = null;
    let maxDate = null;

    tasksWithDates.forEach(t => {
      const s = new Date(t.start_date);
      const e = new Date(t.due_date);
      if (!minDate || s < minDate) minDate = s;
      if (!maxDate || e > maxDate) maxDate = e;
    });

    if (!minDate) {
      const now = new Date();
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
      maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    }

    const paddedStart = new Date(minDate);
    paddedStart.setDate(paddedStart.getDate() - 7);
    const paddedEnd = new Date(maxDate);
    paddedEnd.setDate(paddedEnd.getDate() + 14);

    const start = getMonday(paddedStart);
    const end = paddedEnd;
    const days = Math.ceil((end - start) / DAY_MS) + 1;
    const width = 40;

    const labelMap = {};
    tasksWithDates.forEach(t => {
      const firstLabel = t.labels ? t.labels.split(',')[0].trim() : null;
      const key = firstLabel || 'Ungrouped';
      if (!labelMap[key]) labelMap[key] = [];
      labelMap[key].push(t);
    });

    if (tasksWithoutDates.length > 0) {
      labelMap['No Dates'] = tasksWithoutDates;
    }

    const sortedGroups = Object.entries(labelMap).map(([label, groupTasks]) => {
      const sorted = [...groupTasks].sort((a, b) => {
        if (sortBy !== '') return sortedCompare(a, b);
        if (!a.start_date && !b.start_date) return 0;
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(a.start_date) - new Date(b.start_date);
      });
      return { label, tasks: sorted };
    });

    sortedGroups.sort((a, b) => {
      if (a.label === 'No Dates') return 1;
      if (b.label === 'No Dates') return -1;
      if (a.label === 'Ungrouped') return 1;
      if (b.label === 'Ungrouped') return -1;
      return a.label.localeCompare(b.label);
    });

    return {
      groups: sortedGroups,
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
      dayWidth: width
    };
  }, [filteredTasks, filterLabel, filterPriority, filterAssignee, filterDue, sortBy, sortDir]);

  useEffect(() => {
    if (!timelineStart) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(timelineStart);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - start) / DAY_MS);
    if (diffDays >= 0 && diffDays <= totalDays) {
      setTodayLeft(diffDays * dayWidth + dayWidth / 2);
    } else {
      setTodayLeft(null);
    }
  }, [timelineStart, totalDays, dayWidth]);

  // Center the current date in the viewport on mount.
  useEffect(() => {
    if (!timelineRef.current || todayLeft === null) return;
    const container = timelineRef.current;
    const todayX = leftWidth + todayLeft;
    const target = todayX - container.clientWidth / 2;
    container.scrollLeft = Math.max(0, target);
  }, [todayLeft]);

  const monthColumns = useMemo(() => {
    if (!timelineStart) return [];
    const cols = [];
    const start = new Date(timelineStart);
    const end = new Date(timelineEnd);
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const monthStart = new Date(Math.max(current.getTime(), start.getTime()));
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const clampedEnd = new Date(Math.min(monthEnd.getTime(), end.getTime()));
      const startOffset = Math.floor((monthStart - start) / DAY_MS);
      const daysInView = Math.floor((clampedEnd - monthStart) / DAY_MS) + 1;
      cols.push({
        label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        left: startOffset * dayWidth,
        width: daysInView * dayWidth
      });
      current.setMonth(current.getMonth() + 1);
    }
    return cols;
  }, [timelineStart, timelineEnd, dayWidth]);

  const dayHeaders = useMemo(() => {
    if (!timelineStart) return [];
    const headers = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + i);
      headers.push({
        day: d.getDate(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: isToday(d.toISOString().split('T')[0])
      });
    }
    return headers;
  }, [timelineStart, totalDays]);

  const getBarStyle = (task) => {
    if (!task.start_date || !task.due_date) return null;
    const start = new Date(task.start_date);
    const end = new Date(task.due_date);
    const timelineStartDate = new Date(timelineStart);
    const startOffset = Math.floor((start - timelineStartDate) / DAY_MS);
    const duration = Math.floor((end - start) / DAY_MS) + 1;
    return {
      left: startOffset * dayWidth,
      width: Math.max(duration * dayWidth, 4),
      backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.todo
    };
  };

  const getUserName = (assigneeId) => {
    if (!assigneeId) return null;
    const u = users.find(user => user.id === assigneeId);
    return u ? u.name : null;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDepth = (task) => {
    let depth = 0;
    let current = task;
    while (current.parent_id) {
      depth++;
      current = tasks.find(t => t.id === current.parent_id);
      if (!current) break;
    }
    return depth;
  };

  const timelineWidth = totalDays * dayWidth;
  const leftWidth = 320;

  return (
    <div className="timeline-container">
      <div className="timeline-filters">
        <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
          <option value="">All Labels</option>
          {distinctLabels.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="">All Assignees</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select value={filterSprint} onChange={e => setFilterSprint(e.target.value)}>
          <option value="">All Sprints</option>
          {distinctSprints.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterMilestone} onChange={e => setFilterMilestone(e.target.value)}>
          <option value="">All Milestones</option>
          {distinctMilestones.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={filterDue} onChange={e => setFilterDue(e.target.value)}>
          <option value="">All Due</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due Today</option>
          <option value="week">Due This Week</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="">Sort by: None</option>
          <option value="priority">Sort by: Priority</option>
          <option value="due_date">Sort by: Due Date</option>
          <option value="status">Sort by: Status</option>
          <option value="assignee">Sort by: Assignee</option>
          <option value="title">Sort by: Title</option>
        </select>
        <button
          type="button"
          className="sort-toggle"
          disabled={!sortBy}
          onClick={() => setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'))}
          title={sortDir === 'asc' ? 'Sort: Ascending' : 'Sort: Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      <div className="timeline-scroll" ref={timelineRef}>
        <div className="timeline-inner" style={{ width: leftWidth + timelineWidth }}>
          {/* Sticky top header: left "Task" title + right month/day headers */}
          <div className="timeline-header">
            <div className="timeline-left-header">
              <span className="timeline-left-title">Task</span>
            </div>
            <div className="timeline-right-header" style={{ width: timelineWidth }}>
              {monthColumns.map((col, i) => (
                <div
                  key={i}
                  className="timeline-month"
                  style={{ left: col.left, width: col.width }}
                >
                  {col.label}
                </div>
              ))}
              <div className="timeline-days" style={{ width: timelineWidth }}>
                {dayHeaders.map((h, i) => (
                  <div
                    key={i}
                    className={`timeline-day ${h.isWeekend ? 'weekend' : ''} ${h.isToday ? 'today' : ''}`}
                    style={{ width: dayWidth }}
                  >
                    {h.day}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {todayLeft !== null && (
            <div className="timeline-today-line" style={{ left: leftWidth + todayLeft }} />
          )}

          {filteredTasks.length === 0 && (
            <div className="timeline-empty">No tasks match the filters.</div>
          )}

          {groups.map((group, gi) => (
            <React.Fragment key={gi}>
              <div className="timeline-group-header">
                <div className="timeline-group-header-left-cell">{group.label}</div>
                <div className="timeline-group-header-right-cell" style={{ width: timelineWidth }} />
              </div>
              {group.tasks.map((task) => {
                const barStyle = getBarStyle(task);
                return (
                  <div
                    key={task.id}
                    className={`timeline-row ${getDepth(task) > 0 ? 'subtask-row' : ''}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="timeline-row-left">
                      <div className="timeline-task-info" style={{ paddingLeft: `${getDepth(task) * 1}rem` }}>
                        <span className="timeline-task-name">{task.title}</span>
                        <span className="timeline-task-meta">
                          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                          <span className="timeline-status" style={{ color: STATUS_COLORS[task.status] }}>
                            {STATUS_LABELS[task.status] || task.status}
                          </span>
                          {task.assignee_id && (
                            <span className="timeline-assignee" title={getUserName(task.assignee_id)}>
                              {getInitials(getUserName(task.assignee_id))}
                            </span>
                          )}
                          {task.recurrence && task.recurrence !== 'none' && (
                            <span className="recurrence-badge" title={`Recurring: ${task.recurrence}`}>↻</span>
                          )}
                          {task.blockedBy && task.blockedBy.some(d => d.status !== 'done') && (
                            <span className="blocked-badge" title="Blocked by incomplete dependencies">⛔</span>
                          )}
                          {(() => {
                            const info = dueInfo(task.due_date, task.status);
                            if (!info) return null;
                            const cls = info.overdue ? 'due-chip due-chip-overdue' : (info.days === 0 ? 'due-chip due-chip-today' : 'due-chip');
                            return <span className={cls}>{info.label}</span>;
                          })()}
                        </span>
                      </div>
                      <div className="timeline-task-dates">
                        <span>{formatDateShort(task.start_date)}</span>
                        <span className="timeline-date-sep">–</span>
                        <span>{formatDateShort(task.due_date)}</span>
                        {(task.start_time || task.end_time) && (
                          <span className="timeline-task-times">{task.start_time || '—'}–{task.end_time || '—'}</span>
                        )}
                      </div>
                    </div>
                    <div className="timeline-row-right" style={{ width: timelineWidth }}>
                      {barStyle && (
                        <div
                          className="timeline-bar"
                          style={barStyle}
                          title={`${task.title}: ${formatDate(task.start_date)} – ${formatDate(task.due_date)}${(task.start_time || task.end_time) ? ` (${task.start_time || '—'}–${task.end_time || '—'})` : ''}`}
                        >
                          <span className="timeline-bar-label">{task.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
