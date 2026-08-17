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

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS project_tags (
    project_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (project_id, tag_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS task_labels (
    task_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, label_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    user_id INTEGER,
    changed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_checklist_task ON task_checklist(task_id);
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

  recreateTableWithForeignKeys();
  backfillTagsAndLabels();
}

function backfillTagsAndLabels() {
  const projects = db.prepare('SELECT id, tags FROM projects').all();
  const tasks = db.prepare('SELECT id, labels FROM tasks').all();

  const upsertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insPT = db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)');

  const upsertLabel = db.prepare('INSERT OR IGNORE INTO labels (name) VALUES (?)');
  const getLabel = db.prepare('SELECT id FROM labels WHERE name = ?');
  const insTL = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');

  const txn = db.transaction(() => {
    for (const p of projects) {
      const names = String(p.tags || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        upsertTag.run(name);
        const row = getTag.get(name);
        if (row) insPT.run(p.id, row.id);
      }
    }
    for (const t of tasks) {
      const names = String(t.labels || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        upsertLabel.run(name);
        const row = getLabel.get(name);
        if (row) insTL.run(t.id, row.id);
      }
    }
  });
  txn();
}

function tableHasForeignKey(table, column) {
  const fks = db.pragma(`foreign_key_list(${table})`);
  return fks.some(fk => fk.from === column);
}

function recreateTableWithForeignKeys() {
  // Recreate `projects` to add owner_id FK if missing.
  if (!tableHasForeignKey('projects', 'owner_id')) {
    db.pragma('foreign_keys = OFF');
    db.pragma('legacy_alter_table = ON');
    try {
      db.exec(`
        ALTER TABLE projects RENAME TO projects_old;
        CREATE TABLE projects (
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
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
        );
        INSERT INTO projects (id, name, description, color, archived, status, start_date, due_date, owner_id, priority, progress, tags, created_at, updated_at)
          SELECT id, name, description, color, archived, status, start_date, due_date, owner_id, priority, progress, tags, created_at, updated_at FROM projects_old;
        DROP TABLE projects_old;
      `);
    } finally {
      db.pragma('legacy_alter_table = OFF');
      db.pragma('foreign_keys = ON');
    }
    console.log('Migrated: projects.owner_id foreign key');
  }

  // Recreate `tasks` to add reporter_id FK if missing.
  if (!tableHasForeignKey('tasks', 'reporter_id')) {
    db.pragma('foreign_keys = OFF');
    db.pragma('legacy_alter_table = ON');
    try {
      db.exec(`
        ALTER TABLE tasks RENAME TO tasks_old;
        CREATE TABLE tasks (
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
          recurrence TEXT NOT NULL DEFAULT 'none',
          recurrence_end TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL
        );
        INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, created_at, updated_at)
          SELECT id, project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, created_at, updated_at FROM tasks_old;
        DROP TABLE tasks_old;
      `);
    } finally {
      db.pragma('legacy_alter_table = OFF');
      db.pragma('foreign_keys = ON');
    }
    console.log('Migrated: tasks.reporter_id foreign key');
  }
}

migrate();

export default db;
