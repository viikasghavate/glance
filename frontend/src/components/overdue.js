export function isOverdue(due_date, status, todayStr) {
  const today = todayStr || new Date().toISOString().slice(0, 10);
  return !!(due_date && status !== 'done' && due_date < today);
}
