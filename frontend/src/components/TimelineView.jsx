import React, { useMemo, useRef, useEffect, useState } from 'react';
import './TimelineView.css';

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

  const { groups, timelineStart, timelineEnd, totalDays, dayWidth } = useMemo(() => {
    const tasksWithDates = tasks.filter(t => t.start_date && t.due_date);
    const tasksWithoutDates = tasks.filter(t => !t.start_date || !t.due_date);

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
  }, [tasks]);

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
      <div className="timeline-scroll" ref={timelineRef}>
        <div className="timeline-inner" style={{ width: leftWidth + timelineWidth }}>
          <div className="timeline-header-row">
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

          <div className="timeline-body">
            {todayLeft !== null && (
              <div className="timeline-today-line" style={{ left: leftWidth + todayLeft }} />
            )}

            {groups.map((group, gi) => (
              <React.Fragment key={gi}>
                <div className="timeline-group-header">
                  <div className="timeline-group-header-left">{group.label}</div>
                  <div className="timeline-group-header-right" />
                </div>
                {group.tasks.map((task) => {
                  const barStyle = getBarStyle(task);
                  const depth = getDepth(task);
                  return (
                    <div
                      key={task.id}
                      className={`timeline-row ${depth > 0 ? 'subtask-row' : ''}`}
                      onClick={() => onTaskClick(task)}
                    >
                      <div className="timeline-row-left">
                        <div className="timeline-task-info" style={{ paddingLeft: `${depth * 1}rem` }}>
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
                      <div className="timeline-row-right">
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
    </div>
  );
}
