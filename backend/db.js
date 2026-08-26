import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || '/data/glance.db';

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const uploadsDir = path.join(dbDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
    progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    tags TEXT DEFAULT '',
    deleted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#6366f1',
    archived INTEGER DEFAULT 0,
    deleted_at TEXT,
    owner_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#6366f1',
    archived INTEGER DEFAULT 0,
    deleted_at TEXT,
    owner_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE SET NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
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
    recurrence TEXT NOT NULL DEFAULT 'none',
    recurrence_end TEXT,
    sprint_id INTEGER,
    milestone_id INTEGER,
    deleted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    goal TEXT DEFAULT '',
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER,
    started_at TEXT,
    ended_at TEXT,
    minutes INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    mime_type TEXT,
    uploaded_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS task_watchers (
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    body TEXT,
    payload TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
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
  CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_watchers_user ON task_watchers(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
  CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
  CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_portfolios_owner_id ON portfolios(owner_id);
  CREATE INDEX IF NOT EXISTS idx_programs_portfolio_id ON programs(portfolio_id);
  CREATE INDEX IF NOT EXISTS idx_programs_owner_id ON programs(owner_id);
`);

function hasColumn(table, column) {
  return db.pragma(`table_info(${table})`).some(r => r.name === column);
}

function tableHasForeignKey(table, column) {
  const fks = db.pragma(`foreign_key_list(${table})`);
  return fks.some(fk => fk.from === column);
}

function projectsHasProgressCheck() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'projects'").get();
  return !!(row && row.sql && /progress\s+BETWEEN\s+0\s+AND\s+100/i.test(row.sql));
}

function recreateProjectsTable() {
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
        progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
        tags TEXT DEFAULT '',
        deleted_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
      );
      INSERT INTO projects (id, name, description, color, archived, status, start_date, due_date, owner_id, priority, progress, tags, deleted_at, created_at, updated_at)
        SELECT id, name, description, color, archived, status, start_date, due_date, owner_id, priority, MIN(MAX(progress, 0), 100), tags, NULL, created_at, updated_at FROM projects_old;
      DROP TABLE projects_old;
    `);
  } finally {
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
  }
}

function recreateTasksTable() {
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
        deleted_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE SET NULL
      );
      INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, deleted_at, created_at, updated_at)
        SELECT id, project_id, title, description, status, priority, due_date, assignee_id, position, labels, start_date, estimated_hours, time_spent, reporter_id, archived, parent_id, recurrence, recurrence_end, NULL, created_at, updated_at FROM tasks_old;
      DROP TABLE tasks_old;
    `);
  } finally {
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
  }
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

const migrations = [
  {
    name: 'users_role',
    up: () => {
      if (!hasColumn('users', 'role')) {
        db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
      }
    }
  },
  {
    name: 'users_last_login_at',
    up: () => {
      if (!hasColumn('users', 'last_login_at')) {
        db.exec('ALTER TABLE users ADD COLUMN last_login_at TEXT');
      }
    }
  },
  {
    name: 'projects_status',
    up: () => { if (!hasColumn('projects', 'status')) db.exec("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'"); }
  },
  {
    name: 'projects_start_date',
    up: () => { if (!hasColumn('projects', 'start_date')) db.exec('ALTER TABLE projects ADD COLUMN start_date TEXT'); }
  },
  {
    name: 'projects_due_date',
    up: () => { if (!hasColumn('projects', 'due_date')) db.exec('ALTER TABLE projects ADD COLUMN due_date TEXT'); }
  },
  {
    name: 'projects_owner_id',
    up: () => { if (!hasColumn('projects', 'owner_id')) db.exec('ALTER TABLE projects ADD COLUMN owner_id INTEGER'); }
  },
  {
    name: 'projects_priority',
    up: () => { if (!hasColumn('projects', 'priority')) db.exec("ALTER TABLE projects ADD COLUMN priority TEXT DEFAULT 'medium'"); }
  },
  {
    name: 'projects_progress',
    up: () => { if (!hasColumn('projects', 'progress')) db.exec('ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0'); }
  },
  {
    name: 'projects_tags',
    up: () => { if (!hasColumn('projects', 'tags')) db.exec("ALTER TABLE projects ADD COLUMN tags TEXT DEFAULT ''"); }
  },
  {
    name: 'tasks_labels',
    up: () => { if (!hasColumn('tasks', 'labels')) db.exec("ALTER TABLE tasks ADD COLUMN labels TEXT DEFAULT ''"); }
  },
  {
    name: 'tasks_start_date',
    up: () => { if (!hasColumn('tasks', 'start_date')) db.exec('ALTER TABLE tasks ADD COLUMN start_date TEXT'); }
  },
  {
    name: 'tasks_estimated_hours',
    up: () => { if (!hasColumn('tasks', 'estimated_hours')) db.exec('ALTER TABLE tasks ADD COLUMN estimated_hours REAL'); }
  },
  {
    name: 'tasks_time_spent',
    up: () => { if (!hasColumn('tasks', 'time_spent')) db.exec('ALTER TABLE tasks ADD COLUMN time_spent REAL DEFAULT 0'); }
  },
  {
    name: 'tasks_reporter_id',
    up: () => { if (!hasColumn('tasks', 'reporter_id')) db.exec('ALTER TABLE tasks ADD COLUMN reporter_id INTEGER'); }
  },
  {
    name: 'tasks_archived',
    up: () => { if (!hasColumn('tasks', 'archived')) db.exec('ALTER TABLE tasks ADD COLUMN archived INTEGER DEFAULT 0'); }
  },
  {
    name: 'tasks_parent_id',
    up: () => { if (!hasColumn('tasks', 'parent_id')) db.exec('ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL'); }
  },
  {
    name: 'tasks_recurrence',
    up: () => { if (!hasColumn('tasks', 'recurrence')) db.exec("ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'"); }
  },
  {
    name: 'tasks_recurrence_end',
    up: () => { if (!hasColumn('tasks', 'recurrence_end')) db.exec('ALTER TABLE tasks ADD COLUMN recurrence_end TEXT'); }
  },
  {
    name: 'projects_owner_id_fk_progress_check_deleted_at',
    transactional: false,
    up: () => {
      if (!tableHasForeignKey('projects', 'owner_id') || !projectsHasProgressCheck() || !hasColumn('projects', 'deleted_at')) {
        recreateProjectsTable();
      }
    }
  },
  {
    name: 'tasks_reporter_id_fk_deleted_at',
    transactional: false,
    up: () => {
      if (!tableHasForeignKey('tasks', 'reporter_id') || !hasColumn('tasks', 'deleted_at')) {
        recreateTasksTable();
      }
    }
  },
  {
    name: 'backfill_tags_labels',
    up: () => { backfillTagsAndLabels(); }
  },
  {
    name: 'tasks_sprint_id',
    up: () => {
      if (!hasColumn('tasks', 'sprint_id')) db.exec('ALTER TABLE tasks ADD COLUMN sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL');
      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id)');
    }
  },
  {
    name: 'tasks_milestone_id',
    up: () => {
      if (!hasColumn('tasks', 'milestone_id')) db.exec('ALTER TABLE tasks ADD COLUMN milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL');
      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id)');
    }
  },
  {
    name: 'projects_program_id',
    up: () => {
      if (!hasColumn('projects', 'program_id')) db.exec('ALTER TABLE projects ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL');
    }
  },
  {
    name: 'projects_portfolio_id',
    up: () => {
      if (!hasColumn('projects', 'portfolio_id')) db.exec('ALTER TABLE projects ADD COLUMN portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE SET NULL');
    }
  },
  {
    name: 'tasks_start_time',
    up: () => { if (!hasColumn('tasks', 'start_time')) db.exec('ALTER TABLE tasks ADD COLUMN start_time TEXT'); }
  },
  {
    name: 'tasks_end_time',
    up: () => { if (!hasColumn('tasks', 'end_time')) db.exec('ALTER TABLE tasks ADD COLUMN end_time TEXT'); }
  }
];

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map(r => r.name));

  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    try {
      if (m.transactional === false) {
        m.up();
      } else {
        db.transaction(m.up)();
      }
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(m.name);
      console.log('Migrated:', m.name);
    } catch (err) {
      console.error('Migration failed:', m.name, err.message);
      throw err;
    }
  }
}

runMigrations();

export default db;
