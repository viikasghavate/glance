export function isOverdue(due_date, status, todayStr) {
  const today = todayStr || new Date().toISOString().slice(0, 10);
  return !!(due_date && status !== 'done' && due_date < today);
}

export function dueInfo(due_date, status, todayStr) {
  if (!due_date || status === 'done') return null;
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(due_date) - Date.parse(today)) / 86400000);
  const overdue = diff < 0;
  const days = Math.abs(diff);
  if (diff === 0) return { days: 0, overdue: false, label: 'due today' };
  const label = overdue ? `${days}d overdue` : `${days}d left`;
  return { days, overdue, label };
}
