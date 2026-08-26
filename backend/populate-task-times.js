// One-off script to backfill start_time / end_time for existing tasks that lack them.
// Working-hours window: tasks run 09:00–18:00. start_time = '09:00'. end_time is
// derived from estimated_hours clamped to within the day: min(17:00, 09:00 + estimated_hours).
// No estimated_hours -> '17:00'. Multi-day tasks: 09:00 on start_date .. 17:00 on due_date.
// Idempotent: only fills tasks whose start_time/end_time are NULL.
//
// Usage:
//   DB_PATH=/path/to/glance.db node backend/populate-task-times.js

import db from './db.js';

const START = 9 * 60; // 09:00
const END = 17 * 60; // 17:00 (working-hours end for time-of-day)
const DEFAULT_END = 17 * 60; // 17:00

function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const tasks = db.prepare(`
  SELECT t.id, t.project_id, t.start_date, t.due_date, t.estimated_hours, t.start_time, t.end_time,
         p.due_date AS project_due_date
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  WHERE t.deleted_at IS NULL
    AND (t.start_time IS NULL OR t.end_time IS NULL)
`).all();

const update = db.prepare('UPDATE tasks SET start_time = ?, end_time = ?, updated_at = datetime(\'now\') WHERE id = ?');

const txn = db.transaction(() => {
  for (const t of tasks) {
    const startTime = '09:00';

    let endTime;
    const hours = t.estimated_hours;
    if (hours != null && !Number.isNaN(Number(hours)) && Number(hours) > 0) {
      let endMins = START + Number(hours) * 60;
      if (endMins > END) endMins = END;
      endTime = minutesToHHMM(endMins);
    } else {
      endTime = minutesToHHMM(DEFAULT_END);
    }

    update.run(startTime, endTime, t.id);
  }
});

txn();

console.log(`Populated start_time/end_time for ${tasks.length} task(s).`);
