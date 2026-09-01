// Count verification for the Glance assistant.
// After the model produces a final answer, this module re-queries the live DB
// for the authoritative counts and corrects any number in the reply that
// doesn't match. Deterministic (plain SQL, no AI call) — so counts are always
// right regardless of what the model guessed.

import db from '../db.js';

// Each metric: a label the model might use in its reply, and a query returning
// the authoritative count. Order matters — more specific labels first.
const METRICS = [
  {
    label: 'overdue',
    pattern: /(\d+)\s*(?:overdue|late)\s*(?:tasks?|items?)/gi,
    count: () => db.prepare(
      "SELECT COUNT(*) c FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status != 'done' AND due_date IS NOT NULL AND due_date < date('now')"
    ).get().c
  },
  {
    label: 'in progress',
    pattern: /(\d+)\s*(?:tasks?|items?)\s*(?:that are|currently|marked)?\s*in\s*progress/gi,
    count: () => db.prepare(
      "SELECT COUNT(*) c FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'in_progress'"
    ).get().c
  },
  {
    label: 'done',
    pattern: /(\d+)\s*(?:tasks?|items?)\s*(?:that are|marked|completed)?\s*(?:as\s+)?done/gi,
    count: () => db.prepare(
      "SELECT COUNT(*) c FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'done'"
    ).get().c
  },
  {
    label: 'todo',
    pattern: /(\d+)\s*(?:tasks?|items?)\s*(?:that are|marked)?\s*(?:as\s+)?(?:to\s*do|todo)/gi,
    count: () => db.prepare(
      "SELECT COUNT(*) c FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'todo'"
    ).get().c
  },
  {
    label: 'projects',
    pattern: /(\d+)\s*(?:active\s+)?projects?/gi,
    count: () => db.prepare(
      'SELECT COUNT(*) c FROM projects WHERE archived = 0 AND deleted_at IS NULL'
    ).get().c
  },
  {
    label: 'tasks',
    pattern: /(\d+)\s*(?:total\s+)?tasks?/gi,
    count: () => db.prepare(
      'SELECT COUNT(*) c FROM tasks WHERE archived = 0 AND deleted_at IS NULL'
    ).get().c
  }
];

// Correct any count in the reply that doesn't match the live DB.
// Returns { reply, corrected: [{label, from, to}] }.
export function verifyCounts(reply) {
  if (!reply || typeof reply !== 'string') return { reply, corrected: [] };

  let out = reply;
  const corrected = [];

  for (const m of METRICS) {
    const actual = m.count();
    // Replace every occurrence of "<number> <label>" where the number is wrong.
    out = out.replace(m.pattern, (match, num) => {
      const n = parseInt(num, 10);
      if (n !== actual) {
        corrected.push({ label: m.label, from: n, to: actual });
        return match.replace(num, String(actual));
      }
      return match;
    });
  }

  return { reply: out, corrected };
}
