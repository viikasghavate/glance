import db from '../db.js';

export function createNotification(userId, type, title, body, payload) {
  if (userId == null) return;
  try {
    db.prepare(
      `INSERT INTO notifications (user_id, type, title, body, payload)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      userId,
      type,
      title != null ? title : null,
      body != null ? body : null,
      payload != null ? JSON.stringify(payload) : null
    );
  } catch (err) {
    console.error('createNotification failed:', err.message);
  }
}

export function notifyTaskAssigned(task, assigneeId) {
  if (assigneeId == null) return;
  createNotification(
    assigneeId,
    'task_assigned',
    'Task assigned to you',
    task.title,
    { task_id: task.id, project_id: task.project_id }
  );
}

export function notifyCommentAdded(task, commenterId, commentBody) {
  const recipients = new Set();

  if (task.assignee_id != null) recipients.add(task.assignee_id);
  if (task.reporter_id != null) recipients.add(task.reporter_id);

  const watchers = db.prepare('SELECT user_id FROM task_watchers WHERE task_id = ?').all(task.id);
  for (const w of watchers) recipients.add(w.user_id);

  recipients.delete(commenterId);

  for (const userId of recipients) {
    createNotification(
      userId,
      'comment_added',
      'New comment',
      commentBody,
      { task_id: task.id, project_id: task.project_id }
    );
  }
}

export function notifyDependencyDone(depTask) {
  const blocked = db.prepare(`
    SELECT t.id, t.title, t.project_id, t.assignee_id, t.reporter_id
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.task_id
    WHERE d.depends_on_id = ? AND t.deleted_at IS NULL
  `).all(depTask.id);

  for (const t of blocked) {
    const recipients = new Set();
    if (t.assignee_id != null) recipients.add(t.assignee_id);
    if (t.reporter_id != null) recipients.add(t.reporter_id);
    for (const userId of recipients) {
      createNotification(
        userId,
        'dependency_done',
        'Dependency completed',
        `"${depTask.title}" is done`,
        { task_id: t.id, project_id: t.project_id, depends_on_id: depTask.id }
      );
    }
  }
}
