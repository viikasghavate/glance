import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_PATH = process.env.GLANCE_PG_ENV || '/home/ubuntu/projects/glance/.pg/glance-pg.env';
const DEFAULT_DB =
  process.env.DB_PATH || '/home/ubuntu/projects/glance/backups/glance-pre-pg-20260916-160159.db';
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function parseEnv(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

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

  const db = new Database(DEFAULT_DB, { readonly: true });

  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // FK (dependency) order of tables to migrate, then schema_migrations.
  const order = [
    'users',
    'portfolios',
    'programs',
    'projects',
    'tags',
    'labels',
    'skills',
    'sprints',
    'milestones',
    'tasks',
    'comments',
    'activity_log',
    'task_dependencies',
    'task_checklist',
    'project_tags',
    'task_labels',
    'task_status_history',
    'time_entries',
    'attachments',
    'task_watchers',
    'notifications',
    'ai_sessions',
    'ai_messages',
    'user_skills',
    'project_skill_requirements',
    'skill_endorsements',
    'schema_migrations',
  ];

  const client = new Client(config);

  await client.connect();
  try {
    console.log(`Connected to ${config.host}:${config.port}/${config.database} as ${config.user}`);
    console.log(`Applying schema: ${SCHEMA_PATH}`);
    await client.query(schemaSql);

    console.log('BEGIN transaction');
    await client.query('BEGIN');

    const reports = [];

    for (const table of order) {
      const sqInfo = db.prepare(`PRAGMA table_info("${table}")`).all();
      if (!sqInfo || sqInfo.length === 0) {
        const sqCount = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
        console.log(`[WARN] ${table}: no PRAGMA columns for sqlite table; skipping`);
        reports.push({ table, sq: sqCount, pg: 0 });
        continue;
      }

      const cols = sqInfo.map((c) => c.name);
      const hasId = cols.includes('id');

      const rows = db.prepare(`SELECT * FROM "${table}"`).all();
      const sqCount = rows.length;

      if (rows.length > 0) {
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const colIdent = cols.map((c) => `"${c}"`).join(', ');
        const insertSql = `INSERT INTO "${table}" (${colIdent}) VALUES (${placeholders})`;
        for (const r of rows) {
          await client.query(insertSql, cols.map((c) => {
            const v = r[c];
            return v === undefined ? null : v;
          }));
        }
      }

      if (hasId) {
        const max = sqCount > 0
          ? db.prepare(`SELECT MAX(id) AS m FROM "${table}"`).get().m
          : null;
        if (max != null) {
          await client.query(
            `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), $1, true)`,
            [max]
          );
        } else {
          await client.query(
            `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), 1, false)`
          );
        }
      }

      reports.push({ table, sq: sqCount, pg: null });
    }

    await client.query('COMMIT');

    let pass = true;
    console.log('\nTable counts (sqlite vs pg):');
    for (let i = 0; i < reports.length; i++) {
      const rep = reports[i];
      const pgCount = Number(
        rep.pg !== null
          ? rep.pg
          : (await client.query(`SELECT COUNT(*) AS c FROM "${rep.table}"`)).rows[0].c
      );
      reports[i].pg = pgCount;
      const ok = Number(rep.sq) === Number(pgCount);
      if (!ok) pass = false;
      console.log(
        `  ${rep.table.padEnd(30)} sqlite=${String(rep.sq).padStart(6)}  pg=${String(pgCount).padStart(6)}  ${ok ? 'OK' : 'MISMATCH'}`
      );
    }

    if (pass) {
      console.log('\nPASS: all table counts match');
      process.exitCode = 0;
    } else {
      console.log('\nFAIL: table count mismatch');
      process.exitCode = 1;
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
    console.error('ERROR during migration (rolled back):', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
  db.close();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
