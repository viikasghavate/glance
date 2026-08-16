import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || '/data/glance.db';

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#6366f1',
    archived INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    start_date TEXT,
    due_date TEXT,
    owner_id INTEGER,
    priority TEXT DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    due_date TEXT,
    assignee_id INTEGER,
    position INTEGER DEFAULT 0,
    labels TEXT DEFAULT '',
    start_date TEXT,
    estimated_hours REAL,
    time_spent REAL DEFAULT 0,
    reporter_id INTEGER,
    archived INTEGER DEFAULT 0,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    entity_name TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    depends_on_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_id)
  );

  CREATE TABLE IF NOT EXISTS task_checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

function migrate() {
  const userCols = db.pragma('table_info(users)').map(r => r.name);
  const projectCols = db.pragma('table_info(projects)').map(r => r.name);
  const taskCols = db.pragma('table_info(tasks)').map(r => r.name);

  if (!userCols.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
    console.log('Migrated: users.role');
  }

  if (!userCols.includes('last_login_at')) {
    db.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT');
    console.log('Migrated: users.last_login_at');
  }

  const projectMigrations = [
    { name: 'status', def: "TEXT DEFAULT 'active'" },
    { name: 'start_date', def: 'TEXT' },
    { name: 'due_date', def: 'TEXT' },
    { name: 'owner_id', def: 'INTEGER' },
    { name: 'priority', def: "TEXT DEFAULT 'medium'" },
    { name: 'progress', def: 'INTEGER DEFAULT 0' },
    { name: 'tags', def: "TEXT DEFAULT ''" },
  ];

  const taskMigrations = [
    { name: 'labels', def: "TEXT DEFAULT ''" },
    { name: 'start_date', def: 'TEXT' },
    { name: 'estimated_hours', def: 'REAL' },
    { name: 'time_spent', def: 'REAL DEFAULT 0' },
    { name: 'reporter_id', def: 'INTEGER' },
    { name: 'archived', def: 'INTEGER DEFAULT 0' },
    { name: 'parent_id', def: 'INTEGER REFERENCES tasks(id) ON DELETE SET NULL' },
    { name: 'recurrence', def: "TEXT NOT NULL DEFAULT 'none'" },
    { name: 'recurrence_end', def: 'TEXT' },
  ];

  for (const col of projectMigrations) {
    if (!projectCols.includes(col.name)) {
      db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.def}`);
      console.log(`Migrated: projects.${col.name}`);
    }
  }

  for (const col of taskMigrations) {
    if (!taskCols.includes(col.name)) {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.def}`);
      console.log(`Migrated: tasks.${col.name}`);
    }
  }
}

migrate();

export default db;
