import fs from 'fs';
import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

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

// Translate sqlite-only date helpers to pg equivalents (mirrors parity.js
// translateToPg), applied BEFORE the '?' pass so their string args aren't
// disturbed by placeholder rewriting.
function parseModifier(mod) {
  const sign = mod.trim().startsWith('-') ? -1 : 1;
  const m = mod.match(/(\d+)\s*days/);
  if (!m) throw new Error(`Unhandled date modifier: ${mod}`);
  const days = parseInt(m[1], 10);
  if (days === 0) return '';
  return sign < 0 ? ` - interval '${days} days'` : ` + interval '${days} days'`;
}

// Replace '?' parameter markers with $1..$n, skipping ? inside '...' / "..."
// string literals so a literal question mark is not turned into a param.
function translateQ(sql) {
  sql = sql
    .replace(/datetime\('now'\)/g, "to_char(now(),'YYYY-MM-DD HH24:MI:SS')")
    .replace(/datetime\('now',\s*'([^']+)'\)/g, (m, mod) => {
      const v = parseModifier(mod);
      return `to_char(now()${v},'YYYY-MM-DD HH24:MI:SS')`;
    })
    .replace(/date\('now'\)/g, "to_char(CURRENT_DATE,'YYYY-MM-DD')")
    .replace(/date\('now',\s*'([^']+)'\)/g, (m, mod) => {
      const v = parseModifier(mod);
      return `to_char(CURRENT_DATE${v},'YYYY-MM-DD')`;
    });
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
  transaction: dbTransaction,
};

// alias for compatibility
const _translateQ = translateQ;

function oneParam(param) {
  const p = Array.isArray(param) ? param : [param];
  return p;
}

// ── AsyncLocalStorage transaction routing ──
// Routes call db.transaction(fn) then, INSIDE fn, call the module-global
// db.prepare().run/etc. (not a scoped client). To make those atomic on pg, we
// route every query through the "current" transaction client when one is
// active; otherwise through the pool (autocommit). This mirrors better-sqlite3:
//   const txn = db.transaction(fn); txn();  ->  await db.transaction(fn);
// sqlite txn() is sync (await is a no-op); pg txn() is async.
const als = new AsyncLocalStorage();

async function queryCurrent(sql, params) {
  const client = als.getStore();
  return client ? client.query(sql, params) : pgPool.query(sql, params);
}

export async function dbGet(sql, params = []) {
  const r = await queryCurrent(sql, oneParam(params));
  return r.rows[0] ?? null;
}

export async function dbAll(sql, params = []) {
  const r = await queryCurrent(sql, oneParam(params));
  return r.rows;
}

export async function dbRun(sql, params = []) {
  // better-sqlite3 run() returns { changes, lastInsertRowid }; routes do
  // run() then .get(lastInsertRowid). On pg, for INSERTs append RETURNING id.
  if (/^\s*insert\s+into/i.test(sql)) {
    const withRet = sql.replace(/;\s*$/, '') + ' RETURNING id';
    const rr = await queryCurrent(withRet, oneParam(params));
    const lastInsertRowid = rr.rows && rr.rows.length ? Number(rr.rows[0].id) : null;
    return { changes: rr.rowCount ?? 0, lastInsertRowid };
  }
  const r = await queryCurrent(sql, oneParam(params));
  return { changes: r.rowCount ?? 0, lastInsertRowid: null };
}

export function dbTransaction(fn) {
  // returns an awaitable callable; sqlite's txn() is sync so `await` is a no-op
  return async () => {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const out = await als.run(client, () => fn());
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  };
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
