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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
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
`);

function migrate() {
  const projectCols = db.pragma('table_info(projects)').map(r => r.name);
  const taskCols = db.pragma('table_info(tasks)').map(r => r.name);

  const projectMigrations = [
    { name: 'status', def: "TEXT DEFAULT 'active'" },
    { name: 'start_date', def: 'TEXT' },
    { name: 'due_date', def: 'TEXT' },
    { name: 'owner_id', def: 'INTEGER' },
    { name: 'priority', def: "TEXT DEFAULT 'medium'" },
    { name: 'progress', def: 'INTEGER DEFAULT 0' },
  ];

  const taskMigrations = [
    { name: 'labels', def: "TEXT DEFAULT ''" },
    { name: 'start_date', def: 'TEXT' },
    { name: 'estimated_hours', def: 'REAL' },
    { name: 'time_spent', def: 'REAL DEFAULT 0' },
    { name: 'reporter_id', def: 'INTEGER' },
    { name: 'archived', def: 'INTEGER DEFAULT 0' },
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
