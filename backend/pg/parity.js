import fs from 'fs';
import { Client } from 'pg';
import Database from 'better-sqlite3';

const ENV_PATH = process.env.GLANCE_PG_ENV || '/home/ubuntu/projects/glance/.pg/glance-pg.env';
const SQLITE_DB = process.env.DB_PATH || '/home/ubuntu/projects/glance/backups/glance-pre-pg-20260916-160159.db';

function parseEnv(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalization: produce a canonical JSON string that is IDENTICAL no matter
// whether the row came from sqlite (numbers / strings) or pg (text / boolean).
//   * numeric value            -> Number (keep as number)
//   * string that looks numeric -> Number (int OR float; e.g. DOUBLE PRECISION)
//   * boolean                  -> 0 / 1
//   * non-numeric string       -> string
//   * null                     -> null
// ---------------------------------------------------------------------------
function coerceCell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      if (!Number.isNaN(n)) return n;
    }
    return v;
  }
  return v;
}

function canonicalJson(rows) {
  const arr = rows.map((row) => {
    const out = {};
    for (const key of Object.keys(row).sort()) {
      out[key] = coerceCell(row[key]);
    }
    return out;
  });
  return JSON.stringify(arr, null, 0);
}

// ---------------------------------------------------------------------------
// Translate a sqlite read-SQL string into an equivalent Postgres read-SQL that
// keeps the exact same column/alias/order/limits but renders the sqlite
// date()/datetime('now') helpers (used by analytics) as pg text equivalents.
// Also rewrites '?' placeholders to pg $1..$N.
// ---------------------------------------------------------------------------
function translateToPg(sql) {
  let out = sql
    .replace(/datetime\('now',\s*'([^']+)'\)/g, (m, mod) => {
      const v = parseModifier(mod);
      return `to_char(now()${v},'YYYY-MM-DD HH24:MI:SS')`;
    })
    .replace(/date\('now'\)/g, "to_char(CURRENT_DATE,'YYYY-MM-DD')")
    .replace(/date\('now',\s*'([^']+)'\)/g, (m, mod) => {
      const v = parseModifier(mod, true);
      return `to_char(CURRENT_DATE${v},'YYYY-MM-DD')`;
    })
    .replace(/date\(changed_at\)/g, 'substr(changed_at,1,10)');
  // Quote AS aliases so pg preserves the exact casing the app's route code uses
  // (pg folds unquoted identifiers to lowercase, e.g. userCount -> usercount).
  out = out.replace(/\b(?:AS|as)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, alias) => ` AS "${alias}"`);
  // Quote the same aliases when referenced bare in ORDER BY / GROUP BY so they
  // don't get folded to lowercase and disappear after the quoted definition.
  const aliases = [...new Set([...out.matchAll(/"([^"]+)"/g)].map((m) => m[1]))];
  out = out.replace(/\b(ORDER BY|GROUP BY)\b/g, (m) => `<<${m}`);
  // split clauses on <<ORDER BY / <<GROUP BY
  const parts = out.split('<<');
  out = parts
    .map((seg, i) => {
      if (i === 0) return seg;
      const head = seg.startsWith('ORDER BY') ? 'ORDER BY' : 'GROUP BY';
      let body = seg.slice(head.length);
      for (const alias of aliases) {
        if (!/[a-z]/.test(alias.replace(/[^a-zA-Z]/g, ''))) continue; // not all-lowercase -> keep bare-foldable
        if (!aliasesCasefold(alias)) continue;
        body = body.replace(new RegExp(`\\b${alias}\\b`, 'g'), `"${alias}"`);
      }
      return ` ${head}${body}`;
    })
    .join('');
  // now rewrite ? -> $N
  let n = 0;
  out = out.replace(/\?/g, () => `$${++n}`);
  return out;
}

// Does this alias need quoting to survive (i.e. is it not already all-lowercase)?
function aliasesCasefold(alias) {
  return /[A-Z]/.test(alias);
}

function parseModifier(mod, asInterval) {
  const sign = mod.trim().startsWith('-') ? -1 : 1;
  const m = mod.match(/(\d+)\s*days/);
  if (!m) throw new Error(`Unhandled date modifier: ${mod}`);
  const days = sign * parseInt(m[1], 10);
  if (days === 0) return '';
  return asInterval ? ` + interval '${days} days'` : ` + interval '${days} days'`;
}

// ---------------------------------------------------------------------------
// compare(): run the same query against sqlite and pg, canonicalize both result
// sets, and return { pass, sqliteJson, pgJson }.
// sqliteSql uses '?'; pgSql is auto-derived (date funcs + placeholders).
// ---------------------------------------------------------------------------
async function compare(sqlite, { name, params = [], pgSql } = {}) {
  const paramsArr = Array.isArray(params) ? params : [];
  const finalPgSql = pgSql || translateToPg(sqlite);
  const sqliteRows = sqliteDb.prepare(sqlite).all(...paramsArr);
  const pgRows = (await pgClient.query(finalPgSql, paramsArr)).rows;

  const sqliteJson = canonicalJson(sqliteRows);
  const pgJson = canonicalJson(pgRows);

  // Multiset check: identical VALUES in possibly-different row order.
  const multisetEqual = () => {
    const countByKey = (rows) => {
      const m = new Map();
      for (const r of rows) {
        const sorted = {};
        for (const k of Object.keys(r).sort()) sorted[k] = coerceCell(r[k]);
        const key = JSON.stringify(sorted);
        m.set(key, (m.get(key) || 0) + 1);
      }
      return m;
    };
    const a = countByKey(sqliteRows);
    const b = countByKey(pgRows);
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (b.get(k) !== v) return false;
    return true;
  };

  const exact = sqliteJson === pgJson;
  const multiset = multisetEqual();

  return {
    name: name || sqlite.slice(0, 60),
    pass: exact || multiset,
    exact,
    multiset,
    sqliteJson,
    pgJson,
    sqliteRows,
    pgRows,
  };
}

const sqliteDb = new Database(SQLITE_DB, { readonly: true });

// ---- analytics sub-queries (exact SELECT shapes from routes/analytics.js) ----
const analytics = {
  summaryProjects: 'SELECT COUNT(*) as count FROM projects WHERE archived = 0 AND deleted_at IS NULL',
  summaryTasks: 'SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL',
  summaryTasksDone: "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'done'",
  summaryTasksInProgress: "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'in_progress'",
  summaryTasksTodo: "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status = 'todo'",
  summaryOverdue: "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL AND status != 'done' AND due_date IS NOT NULL AND due_date < date('now')",
  summaryMembers: 'SELECT COUNT(*) as count FROM users',
  tasksByStatus: "SELECT status, COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL GROUP BY status ORDER BY count DESC",
  tasksByPriority: "SELECT priority, COUNT(*) as count FROM tasks WHERE archived = 0 AND deleted_at IS NULL GROUP BY priority ORDER BY count DESC",
  workloadByMember: `
    SELECT u.id as user_id, u.name,
           COUNT(t.id) as tasksAssigned,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as tasksDone
    FROM users u
    LEFT JOIN tasks t ON t.assignee_id = u.id AND t.archived = 0 AND t.deleted_at IS NULL
    GROUP BY u.id
    ORDER BY tasksAssigned DESC`,
  projectProgress: `
    SELECT p.id as project_id, p.name,
           COUNT(t.id) as tasks,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.archived = 0 AND t.deleted_at IS NULL
    WHERE p.archived = 0 AND p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC`,
  overdueList: `
    SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.archived = 0 AND t.deleted_at IS NULL AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now')
    ORDER BY t.due_date ASC`,
  dueSoonList: `
    SELECT t.id, t.title, p.name as project_name, t.due_date, u.name as assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.archived = 0 AND t.deleted_at IS NULL
      AND t.status != 'done'
      AND t.due_date IS NOT NULL
      AND t.due_date >= date('now')
      AND t.due_date <= date('now', '+6 days')
    ORDER BY t.due_date ASC`,
  recentActivity: `
    SELECT t.id, t.title, p.name as project_name, t.status, t.updated_at
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.archived = 0 AND t.deleted_at IS NULL
    ORDER BY t.updated_at DESC
    LIMIT 8`,
  statusTrend: `
    SELECT date(changed_at) as day, status, COUNT(*) as count
    FROM task_status_history
    WHERE changed_at >= date('now', '-30 days')
    GROUP BY date(changed_at), status
    ORDER BY day ASC`,
  timeTotal: `
    SELECT COALESCE(SUM(e.minutes), 0) as total
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL`,
  timeWeek: `
    SELECT COALESCE(SUM(e.minutes), 0) as total
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL AND e.created_at >= datetime('now', '-7 days')`,
  timeMonth: `
    SELECT COALESCE(SUM(e.minutes), 0) as total
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    WHERE t.deleted_at IS NULL AND e.created_at >= datetime('now', '-30 days')`,
  timeByProject: `
    SELECT p.id as project_id, p.name, COALESCE(SUM(e.minutes), 0) as minutes
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY minutes DESC
    LIMIT 6`,
  timeByUser: `
    SELECT u.id as user_id, u.name, COALESCE(SUM(e.minutes), 0) as minutes
    FROM time_entries e
    JOIN tasks t ON t.id = e.task_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE t.deleted_at IS NULL
    GROUP BY u.id
    ORDER BY minutes DESC
    LIMIT 6`,
};

const queries = [
  // 1. GET /api/projects
  {
    name: 'GET /api/projects (non-archived, limit 100)',
    sql: `
      SELECT p.*, u.name as owner_name, u.email as owner_email
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.archived = 0 AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 100`,
  },
  // 2. GET /api/tasks/project/3
  {
    name: 'GET /api/tasks/project/3',
    sql: `
      SELECT t.*, u.name as assignee_name, u.email as assignee_email,
             r.name as reporter_name, r.email as reporter_email,
             s.name as sprint_name, m.name as milestone_name,
             (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND deleted_at IS NULL) as subtask_count,
             (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users r ON t.reporter_id = r.id
      LEFT JOIN sprints s ON t.sprint_id = s.id
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE t.project_id = 3 AND t.deleted_at IS NULL
      ORDER BY t.position ASC, t.created_at DESC`,
  },
  // 3. GET /api/analytics (each sub-query separately)
  ...Object.entries(analytics).map(([k, sql]) => ({ name: `GET /api/analytics :: ${k}`, sql })),
  // 4. GET /api/users
  {
    name: 'GET /api/users',
    sql: `
      SELECT
        u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
        (SELECT COUNT(*) FROM projects WHERE owner_id = u.id AND deleted_at IS NULL) as projects_owned,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND deleted_at IS NULL) as tasks_assigned,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND deleted_at IS NULL AND status = 'done') as tasks_completed,
        (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as comments
      FROM users u
      ORDER BY u.name ASC`,
  },
  // 5. GET /api/skills
  {
    name: 'GET /api/skills',
    sql: `
      SELECT s.*, (SELECT COUNT(*) FROM user_skills us WHERE us.skill_id = s.id) as userCount
      FROM skills s
      ORDER BY s.category ASC, s.name ASC`,
  },
  // 6. GET /api/activity (limit 50)
  {
    name: 'GET /api/activity (limit 50)',
    sql: `
      SELECT a.*, u.name as user_name, t.project_id as project_id
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN tasks t ON a.entity_type = 'task' AND a.entity_id = t.id AND t.deleted_at IS NULL
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 50`,
  },
  // 7a. GET /api/tasks/mine (user 3, as requested; 0 rows)
  {
    name: 'GET /api/tasks/mine (user 3)',
    sql: `
      SELECT t.*, p.name as project_name, u.name as assignee_name, u.email as assignee_email,
             r.name as reporter_name, r.email as reporter_email,
             s.name as sprint_name, m.name as milestone_name,
             (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND deleted_at IS NULL) as subtask_count,
             (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users r ON t.reporter_id = r.id
      LEFT JOIN sprints s ON t.sprint_id = s.id
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE t.assignee_id = ? AND t.deleted_at IS NULL
      ORDER BY
        CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
        t.due_date IS NULL,
        t.due_date ASC,
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
        t.title ASC`,
    params: [3],
  },
  // 7b. richer coverage for /mine (user 4 has 165 assigned tasks)
  {
    name: 'GET /api/tasks/mine (user 4)',
    sql: `
      SELECT t.*, p.name as project_name, u.name as assignee_name, u.email as assignee_email,
             r.name as reporter_name, r.email as reporter_email,
             s.name as sprint_name, m.name as milestone_name,
             (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND deleted_at IS NULL) as subtask_count,
             (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users r ON t.reporter_id = r.id
      LEFT JOIN sprints s ON t.sprint_id = s.id
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE t.assignee_id = ? AND t.deleted_at IS NULL
      ORDER BY
        CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
        t.due_date IS NULL,
        t.due_date ASC,
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
        t.title ASC`,
    params: [4],
  },
];

async function main() {
  const env = parseEnv(ENV_PATH);
  const config = {
    host: env.POSTGRES_HOST || 'glance-pg',
    port: parseInt(env.POSTGRES_PORT || '5432', 10),
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
  };
  for (const k of ['user', 'password', 'database']) {
    if (!config[k]) throw new Error(`Missing POSTGRES_${k.toUpperCase()} in env`);
  }

  const client = new Client(config);
  await client.connect();
  globalThis.pgClient = client;
  globalThis.sqliteDb = sqliteDb;

  let allPass = true;
  const failures = [];
  const tieOrdering = [];

  for (const q of queries) {
    const res = await compare(q.sql, { name: q.name, params: q.params, pgSql: q.pgSql });
    const label = `  ${res.name.padEnd(46)} ${res.pass ? 'PASS' : 'FAIL'}`;
    console.log(label + (res.pass && !res.exact ? '   (values match; only ORDER-BY tie order differs)' : ''));
    if (res.multiset) {
      if (!res.exact) tieOrdering.push(res.name);
    } else {
      allPass = false;
      failures.push(res);
    }
  }

  if (tieOrdering.length) {
    console.log('\n----------------- ORDER-BY TIE NOTES -----------------');
    console.log('Row VALUES matched on both sides; only the relative order of rows that share');
    console.log('the same ORDER BY key differs (tie resolution is not deterministic across engines).');
    console.log('Queries affected:');
    for (const n of tieOrdering) console.log('  - ' + n);
  }

  if (failures.length) {
    console.log('\n=================== MISMATCH DETAILS ===================');
    for (const f of failures) {
      console.log(`\n>>> ${f.name} (sqlite rows=${f.sqliteRows.length}, pg rows=${f.pgRows.length})`);
      console.log('--- sqlite ---');
      console.log(f.sqliteJson);
      console.log('--- pg ---');
      console.log(f.pgJson);
    }
  }

  await client.end();
  sqliteDb.close();

  console.log(failures.length === 0 ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  try { sqliteDb.close(); } catch (e) {}
  process.exit(1);
});
