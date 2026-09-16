import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

// Runtime parse of the secrets env file — never read it at authoring time.
function parseEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = parseEnv(process.env.GLANCE_PG_ENV || '/home/ubuntu/projects/glance/.pg/glance-pg.env');

export const pgPool = new Pool({
  host: env.POSTGRES_HOST || 'glance-pg',
  port: parseInt(env.POSTGRES_PORT || '5432', 10),
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  max: 10,
});

// Async wrappers mirroring the better-sqlite3 API the routes use:
//   db.prepare(sql).get(...params)   ->  await dbGet(sql, params)
//   db.prepare(sql).all(...params)   ->  await dbAll(sql, params)
//   db.prepare(sql).run(...params)   ->  await dbRun(sql, params)  (returns {changes})
//   db.prepare(sql).get() with no params -> await dbGet(sql, [])
//
// Parameter markers: better-sqlite3 uses '?'; pg uses $1..$n. Routes are
// rewritten to use $1.. (kept explicit per query). All camelCase aliases in
// SELECT are double-quoted so pg preserves exact key case.

// Convert a ?-style SQL to $-style is NOT done automatically here (ambiguous
// with literals); route rewrites pass explicit $-SQL. These helpers just run
// what they're given.

// better-sqlite3-compatible adapter so route diffs are minimal:
//   const row = db.prepare(sql).get(...p)      ->  await db.prepare(sql).get(...p)
//   const rows = db.prepare(sql).all(...p)     ->  await db.prepare(sql).all(...p)
//   const info = db.prepare(sql).run(...p)     ->  await db.prepare(sql).run(...p)
//
// SQL stays on the sqlite-native '?' dialect (both engines accept '?' after
// translation) so routes keep ONE SQL string. The '?' -> '$n' translation is
// done here at runtime, scanning outside single/double-quoted string literals,
// so the same statement works on sqlite (natively) and pg (after this step).

// Replace '?' parameter markers with $1..$n, skipping ? inside '...' / "..."
// string literals so a literal question mark is not turned into a param.
function translateQ(sql) {
  let out = '';
  let i = 0;
  let n = 0;
  let inStr = null; // null | "'" | '"'
  while (i < sql.length) {
    const ch = sql[i];
    if (inStr) {
      out += ch;
      if (ch === inStr) {
        // handle doubled-quote escape ('' / "" -> literal quote)
        if (sql[i + 1] === inStr) { out += sql[i + 1]; i += 2; continue; }
        inStr = null;
      }
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; out += ch; i++; continue; }
    if (ch === '?') { n++; out += `$${n}`; i++; continue; }
    out += ch;
    i++;
  }
  return { sql: out, paramCount: n };
}

export const db = {
  prepare(sql) {
    const t = translateQ(sql);
    const pgSql = t.sql;
    return {
      get: (...params) => dbGet(pgSql, params),
      all: (...params) => dbAll(pgSql, params),
      run: (...params) => dbRun(pgSql, params),
    };
  },
};

// export the translator for the parity/verification layer if needed
const _translateQ = translateQ;

function oneParam(param) {
  const p = Array.isArray(param) ? param : [param];
  return p;
}

export async function dbGet(sql, params = []) {
  const r = await pgPool.query(sql, oneParam(params));
  return r.rows[0] ?? null;
}

export async function dbAll(sql, params = []) {
  const r = await pgPool.query(sql, oneParam(params));
  return r.rows;
}

export async function dbRun(sql, params = []) {
  const r = await pgPool.query(sql, oneParam(params));
  return { changes: r.rowCount ?? 0, lastID: null };
}

// Run inside an explicit transaction. Caller passes an async fn(conn) that
// uses dbGet/dbAll/dbRun scoped to that connection. Simple usage: just call
// the exported wrappers (autocommit) — this is for multi-statement atomic ops.
export async function withTransaction(fn) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const conn = {
      get: (sql, params = []) => client.query(sql, oneParam(params)).then(r => r.rows[0] ?? null),
      all: (sql, params = []) => client.query(sql, oneParam(params)).then(r => r.rows),
      run: (sql, params = []) => client.query(sql, oneParam(params)).then(r => ({ changes: r.rowCount ?? 0 })),
    };
    const out = await fn(conn);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
