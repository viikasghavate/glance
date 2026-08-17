import db from '../db.js';

function parseList(str) {
  if (str == null) return [];
  return String(str)
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function upsertNames(table, names) {
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`);
  const select = db.prepare(`SELECT id FROM ${table} WHERE name = ?`);
  const ids = [];
  for (const name of names) {
    insert.run(name);
    const row = select.get(name);
    if (row) ids.push(row.id);
  }
  return ids;
}

export function syncProjectTags(projectId, tagsString) {
  const names = parseList(tagsString);
  const ids = upsertNames('tags', names);
  const del = db.prepare('DELETE FROM project_tags WHERE project_id = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');
  const txn = db.transaction(() => {
    del.run(projectId);
    for (const tagId of ids) ins.run(projectId, tagId);
  });
  txn();
}

export function syncTaskLabels(taskId, labelsString) {
  const names = parseList(labelsString);
  const ids = upsertNames('labels', names);
  const del = db.prepare('DELETE FROM task_labels WHERE task_id = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
  const txn = db.transaction(() => {
    del.run(taskId);
    for (const labelId of ids) ins.run(taskId, labelId);
  });
  txn();
}

export function getProjectTags(projectId) {
  return db.prepare(`
    SELECT t.name FROM tags t
    JOIN project_tags pt ON pt.tag_id = t.id
    WHERE pt.project_id = ?
    ORDER BY t.name ASC
  `).all(projectId).map(r => r.name);
}

export function getTaskLabels(taskId) {
  return db.prepare(`
    SELECT l.name FROM labels l
    JOIN task_labels tl ON tl.label_id = l.id
    WHERE tl.task_id = ?
    ORDER BY l.name ASC
  `).all(taskId).map(r => r.name);
}
