// Demo data seeder for Glance.
// Adds 10+ demo projects with tasks across all states (todo/in_progress/done),
// priorities, sprints, milestones, comments, labels, tags, dependencies,
// checklists, time entries, watchers and notifications.
//
// Preserves existing data (real projects/tasks/users are left untouched).
// Idempotent: safe to re-run — skips projects that already exist by name.
//
// Usage (against live DB in container):
//   docker cp backend/seed-demo.js <container>:/app/seed-demo.js
//   docker exec <container> node seed-demo.js
//   docker exec <container> rm /app/seed-demo.js
//
// Or locally against a DB_PATH:
//   DB_PATH=/path/to/glance.db node backend/seed-demo.js

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || '/data/glance.db';
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// ---------- helpers ----------
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function upsertUser(email, name, role, password) {
  let u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!u) {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
    ).run(email, hash, name, role);
    u = { id: r.lastInsertRowid };
    console.log(`  + user ${email}`);
  }
  return u.id;
}

function insertProject(p) {
  const existing = db.prepare('SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL').get(p.name);
  if (existing) {
    console.log(`  = project "${p.name}" already exists (id ${existing.id}), skipping`);
    return existing.id;
  }
  const r = db.prepare(`
    INSERT INTO projects (name, description, color, status, start_date, due_date, owner_id, priority, progress, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.name, p.description || '', p.color || '#6366f1', p.status || 'active',
    p.start_date || null, p.due_date || null, p.owner_id || null,
    p.priority || 'medium', p.progress ?? 0, p.tags || ''
  );
  const id = r.lastInsertRowid;
  // tags
  if (p.tags) {
    for (const t of p.tags.split(',').map(s => s.trim()).filter(Boolean)) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(t);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(t);
      db.prepare('INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)').run(id, tag.id);
    }
  }
  console.log(`  + project "${p.name}" (id ${id})`);
  return id;
}

function insertTask(t) {
  const r = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, assignee_id,
      position, labels, start_date, estimated_hours, time_spent, reporter_id, sprint_id, milestone_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    t.project_id, t.title, t.description || '', t.status || 'todo', t.priority || 'medium',
    t.due_date || null, t.assignee_id || null, t.position ?? 0, t.labels || '',
    t.start_date || null, t.estimated_hours ?? null, t.time_spent ?? 0,
    t.reporter_id || null, t.sprint_id || null, t.milestone_id || null
  );
  const id = r.lastInsertRowid;
  // labels
  if (t.labels) {
    for (const l of t.labels.split(',').map(s => s.trim()).filter(Boolean)) {
      db.prepare('INSERT OR IGNORE INTO labels (name) VALUES (?)').run(l);
      const lab = db.prepare('SELECT id FROM labels WHERE name = ?').get(l);
      db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)').run(id, lab.id);
    }
  }
  // status history
  db.prepare('INSERT INTO task_status_history (task_id, status, user_id) VALUES (?, ?, ?)')
    .run(id, t.status, t.assignee_id || t.reporter_id || null);
  return id;
}

function insertSprint(projectId, name, goal, start, end, status) {
  const r = db.prepare(
    'INSERT INTO sprints (project_id, name, goal, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(projectId, name, goal || '', start, end, status || 'planned');
  return r.lastInsertRowid;
}

function insertMilestone(projectId, name, description, due, status) {
  const r = db.prepare(
    'INSERT INTO milestones (project_id, name, description, due_date, status) VALUES (?, ?, ?, ?, ?)'
  ).run(projectId, name, description || '', due, status || 'open');
  return r.lastInsertRowid;
}

function insertComment(taskId, userId, body) {
  db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)')
    .run(taskId, userId, body);
}

function insertChecklist(taskId, items) {
  items.forEach((text, i) => {
    db.prepare('INSERT INTO task_checklist (task_id, text, completed, position) VALUES (?, ?, ?, ?)')
      .run(taskId, text, 0, i);
  });
}

function insertDependency(taskId, dependsOnId) {
  db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)')
    .run(taskId, dependsOnId);
}

function insertTimeEntry(taskId, userId, minutes, note) {
  db.prepare('INSERT INTO time_entries (task_id, user_id, minutes, note) VALUES (?, ?, ?, ?)')
    .run(taskId, userId, minutes, note || '');
}

function insertWatcher(taskId, userId) {
  db.prepare('INSERT OR IGNORE INTO task_watchers (task_id, user_id) VALUES (?, ?)')
    .run(taskId, userId);
}

function insertNotification(userId, type, title, body, taskId) {
  db.prepare('INSERT INTO notifications (user_id, type, title, body, payload) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, title, body, JSON.stringify({ task_id: taskId }));
}

function upsertSkill(name, category, description) {
  db.prepare('INSERT OR IGNORE INTO skills (name, category, description) VALUES (?, ?, ?)')
    .run(name, category || '', description || '');
  return db.prepare('SELECT id FROM skills WHERE name = ?').get(name).id;
}

function upsertUserSkill(userId, skillId, level, years) {
  db.prepare(`
    INSERT INTO user_skills (user_id, skill_id, level, years_experience)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, skill_id) DO UPDATE SET
      level = excluded.level,
      years_experience = excluded.years_experience,
      updated_at = datetime('now')
  `).run(userId, skillId, level, years ?? 0);
}

// ---------- main ----------
console.log('Seeding demo data into', dbPath);

// Ensure demo users exist (in addition to any real users).
const viki = upsertUser('glance@ghavate.com', 'Viikas Ghavate', 'admin', 'admin123');
const admin = upsertUser('admin@glance.local', 'Admin', 'admin', 'admin123');
const dev = upsertUser('demo.dev@glance.local', 'Demo Dev', 'member', 'demo123');
const pm = upsertUser('demo.pm@glance.local', 'Demo PM', 'member', 'demo123');
const designer = upsertUser('demo.design@glance.local', 'Demo Designer', 'member', 'demo123');

const users = [viki, admin, dev, pm, designer];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const seed = db.transaction(() => {
  // ============ 1. Website Redesign ============
  const p1 = insertProject({
    name: 'Website Redesign',
    description: 'Full redesign of the marketing site: new visual identity, responsive layout, and improved conversion funnel.',
    color: '#6366f1', status: 'active', priority: 'high', progress: 45,
    start_date: daysFromNow(-30), due_date: daysFromNow(30), owner_id: pm,
    tags: 'marketing,frontend,design'
  });
  const m1a = insertMilestone(p1, 'Design phase complete', 'All mockups approved', daysFromNow(-5), 'completed');
  const m1b = insertMilestone(p1, 'Frontend build', 'All pages built and responsive', daysFromNow(20), 'open');
  const s1a = insertSprint(p1, 'Sprint 1 — Discovery', 'Audit and wireframes', daysFromNow(-30), daysFromNow(-16), 'completed');
  const s1b = insertSprint(p1, 'Sprint 2 — Design', 'High-fidelity mockups', daysFromNow(-15), daysFromNow(-1), 'completed');
  const s1c = insertSprint(p1, 'Sprint 3 — Build', 'Implement pages', daysFromNow(0), daysFromNow(14), 'active');
  const t1 = insertTask({ project_id: p1, title: 'Audit current site & analytics', description: 'Review bounce rates, page speed, and conversion paths.', status: 'done', priority: 'high', due_date: daysFromNow(-28), assignee_id: pm, reporter_id: viki, labels: 'research', sprint_id: s1a, milestone_id: m1a, estimated_hours: 8, time_spent: 7.5 });
  const t2 = insertTask({ project_id: p1, title: 'Create wireframes for all pages', description: 'Home, product, pricing, blog, contact.', status: 'done', priority: 'high', due_date: daysFromNow(-20), assignee_id: designer, reporter_id: pm, labels: 'design', sprint_id: s1a, milestone_id: m1a, estimated_hours: 16, time_spent: 15 });
  const t3 = insertTask({ project_id: p1, title: 'Design new visual identity', description: 'Logo, color palette, typography system.', status: 'done', priority: 'high', due_date: daysFromNow(-10), assignee_id: designer, reporter_id: pm, labels: 'design', sprint_id: s1b, milestone_id: m1a, estimated_hours: 20, time_spent: 22 });
  const t4 = insertTask({ project_id: p1, title: 'Build responsive homepage', description: 'Hero, features, testimonials, CTA sections.', status: 'in_progress', priority: 'high', due_date: daysFromNow(7), assignee_id: dev, reporter_id: pm, labels: 'frontend', sprint_id: s1c, milestone_id: m1b, estimated_hours: 24, time_spent: 10 });
  const t5 = insertTask({ project_id: p1, title: 'Build pricing page', status: 'in_progress', priority: 'medium', due_date: daysFromNow(10), assignee_id: dev, reporter_id: pm, labels: 'frontend', sprint_id: s1c, milestone_id: m1b, estimated_hours: 12, time_spent: 4 });
  const t6 = insertTask({ project_id: p1, title: 'Implement blog & CMS integration', status: 'todo', priority: 'medium', due_date: daysFromNow(14), assignee_id: dev, reporter_id: pm, labels: 'backend', sprint_id: s1c, milestone_id: m1b, estimated_hours: 16 });
  const t7 = insertTask({ project_id: p1, title: 'Cross-browser & mobile testing', status: 'todo', priority: 'high', due_date: daysFromNow(18), assignee_id: dev, reporter_id: pm, labels: 'qa', milestone_id: m1b, estimated_hours: 10 });
  const t8 = insertTask({ project_id: p1, title: 'SEO & performance optimization', status: 'todo', priority: 'medium', due_date: daysFromNow(25), assignee_id: dev, reporter_id: pm, labels: 'backend,qa', milestone_id: m1b, estimated_hours: 12 });
  insertDependency(t4, t3);
  insertDependency(t5, t4);
  insertDependency(t7, t6);
  insertChecklist(t4, ['Set up Tailwind config', 'Build hero section', 'Add responsive nav', 'Wire up CTA form']);
  insertComment(t4, pm, 'Hero section is looking great, keep it up!');
  insertComment(t4, dev, 'Nav is done, working on the CTA form now.');
  insertTimeEntry(t4, dev, 240, 'Homepage build');
  insertTimeEntry(t5, dev, 90, 'Pricing layout');
  insertWatcher(t4, viki);
  insertWatcher(t4, pm);
  insertNotification(pm, 'task_assigned', 'Task assigned', 'Build responsive homepage', t4);

  // ============ 2. Mobile App Launch ============
  const p2 = insertProject({
    name: 'Mobile App Launch',
    description: 'Ship v1.0 of the iOS & Android app to the App Store and Play Store.',
    color: '#f59e0b', status: 'active', priority: 'high', progress: 60,
    start_date: daysFromNow(-45), due_date: daysFromNow(20), owner_id: viki,
    tags: 'mobile,product'
  });
  const m2a = insertMilestone(p2, 'Beta release', 'Internal beta to testers', daysFromNow(-3), 'completed');
  const m2b = insertMilestone(p2, 'Store submission', 'Submit to both stores', daysFromNow(15), 'open');
  const s2a = insertSprint(p2, 'Sprint 1 — Core features', 'Auth, feed, profile', daysFromNow(-45), daysFromNow(-20), 'completed');
  const s2b = insertSprint(p2, 'Sprint 2 — Polish', 'Animations, empty states, onboarding', daysFromNow(-19), daysFromNow(-2), 'completed');
  const s2c = insertSprint(p2, 'Sprint 3 — Release', 'Beta fixes, store assets', daysFromNow(0), daysFromNow(14), 'active');
  const t9 = insertTask({ project_id: p2, title: 'Implement authentication flow', status: 'done', priority: 'high', due_date: daysFromNow(-40), assignee_id: dev, reporter_id: viki, labels: 'backend', sprint_id: s2a, milestone_id: m2a, estimated_hours: 20, time_spent: 18 });
  const t10 = insertTask({ project_id: p2, title: 'Build home feed', status: 'done', priority: 'high', due_date: daysFromNow(-30), assignee_id: dev, reporter_id: viki, labels: 'frontend', sprint_id: s2a, milestone_id: m2a, estimated_hours: 24, time_spent: 26 });
  const t11 = insertTask({ project_id: p2, title: 'User profile & settings', status: 'done', priority: 'medium', due_date: daysFromNow(-22), assignee_id: dev, reporter_id: viki, labels: 'frontend', sprint_id: s2a, milestone_id: m2a, estimated_hours: 16, time_spent: 14 });
  const t12 = insertTask({ project_id: p2, title: 'Onboarding screens', status: 'done', priority: 'medium', due_date: daysFromNow(-8), assignee_id: designer, reporter_id: viki, labels: 'design', sprint_id: s2b, milestone_id: m2a, estimated_hours: 12, time_spent: 11 });
  const t13 = insertTask({ project_id: p2, title: 'Fix beta crash on Android 14', status: 'in_progress', priority: 'high', due_date: daysFromNow(3), assignee_id: dev, reporter_id: viki, labels: 'bug', sprint_id: s2c, milestone_id: m2b, estimated_hours: 8, time_spent: 3 });
  const t14 = insertTask({ project_id: p2, title: 'Prepare store screenshots & descriptions', status: 'in_progress', priority: 'medium', due_date: daysFromNow(8), assignee_id: designer, reporter_id: viki, labels: 'marketing', sprint_id: s2c, milestone_id: m2b, estimated_hours: 10, time_spent: 2 });
  const t15 = insertTask({ project_id: p2, title: 'Submit to App Store', status: 'todo', priority: 'high', due_date: daysFromNow(12), assignee_id: viki, reporter_id: viki, labels: 'release', milestone_id: m2b, estimated_hours: 4 });
  const t16 = insertTask({ project_id: p2, title: 'Submit to Play Store', status: 'todo', priority: 'high', due_date: daysFromNow(13), assignee_id: viki, reporter_id: viki, labels: 'release', milestone_id: m2b, estimated_hours: 4 });
  insertDependency(t13, t12);
  insertDependency(t15, t13);
  insertDependency(t16, t13);
  insertChecklist(t13, ['Reproduce crash', 'Add null check', 'Release hotfix build']);
  insertComment(t13, dev, 'Found the root cause — a null pointer in the media picker.');
  insertTimeEntry(t13, dev, 180, 'Crash investigation');
  insertWatcher(t13, viki);
  insertNotification(viki, 'due_soon', 'Due soon', 'Fix beta crash on Android 14', t13);

  // ============ 3. API Platform v2 ============
  const p3 = insertProject({
    name: 'API Platform v2',
    description: 'Rebuild the public API with versioning, rate limiting, and webhooks.',
    color: '#10b981', status: 'active', priority: 'high', progress: 30,
    start_date: daysFromNow(-20), due_date: daysFromNow(40), owner_id: dev,
    tags: 'backend,api'
  });
  const m3a = insertMilestone(p3, 'API design freeze', 'OpenAPI spec approved', daysFromNow(10), 'open');
  const s3a = insertSprint(p3, 'Sprint 1 — Foundation', 'Spec, auth, rate limiting', daysFromNow(-20), daysFromNow(-6), 'completed');
  const s3b = insertSprint(p3, 'Sprint 2 — Core endpoints', 'CRUD + webhooks', daysFromNow(-5), daysFromNow(9), 'active');
  const t17 = insertTask({ project_id: p3, title: 'Write OpenAPI 3.0 spec', status: 'done', priority: 'high', due_date: daysFromNow(-15), assignee_id: dev, reporter_id: viki, labels: 'docs', sprint_id: s3a, milestone_id: m3a, estimated_hours: 20, time_spent: 19 });
  const t18 = insertTask({ project_id: p3, title: 'Implement OAuth2 + JWT auth', status: 'done', priority: 'high', due_date: daysFromNow(-8), assignee_id: dev, reporter_id: viki, labels: 'backend', sprint_id: s3a, milestone_id: m3a, estimated_hours: 16, time_spent: 15 });
  const t19 = insertTask({ project_id: p3, title: 'Add rate limiting middleware', status: 'in_progress', priority: 'medium', due_date: daysFromNow(4), assignee_id: dev, reporter_id: viki, labels: 'backend', sprint_id: s3b, milestone_id: m3a, estimated_hours: 8, time_spent: 2 });
  const t20 = insertTask({ project_id: p3, title: 'Build CRUD endpoints for resources', status: 'in_progress', priority: 'high', due_date: daysFromNow(12), assignee_id: dev, reporter_id: viki, labels: 'backend', sprint_id: s3b, estimated_hours: 30, time_spent: 8 });
  const t21 = insertTask({ project_id: p3, title: 'Implement webhook delivery system', status: 'todo', priority: 'high', due_date: daysFromNow(20), assignee_id: dev, reporter_id: viki, labels: 'backend', sprint_id: s3b, estimated_hours: 20 });
  const t22 = insertTask({ project_id: p3, title: 'Write API documentation portal', status: 'todo', priority: 'medium', due_date: daysFromNow(30), assignee_id: pm, reporter_id: viki, labels: 'docs', estimated_hours: 12 });
  insertDependency(t19, t18);
  insertDependency(t20, t19);
  insertDependency(t21, t20);
  insertChecklist(t20, ['List endpoint', 'Create endpoint', 'Update endpoint', 'Delete endpoint']);
  insertComment(t20, dev, 'List and create are done, moving to update.');
  insertTimeEntry(t20, dev, 480, 'CRUD build');
  insertWatcher(t20, viki);

  // ============ 4. Data Migration to Postgres ============
  const p4 = insertProject({
    name: 'Data Migration to Postgres',
    description: 'Migrate production data from MySQL to Postgres with zero downtime.',
    color: '#ef4444', status: 'active', priority: 'high', progress: 75,
    start_date: daysFromNow(-60), due_date: daysFromNow(10), owner_id: viki,
    tags: 'infra,backend'
  });
  const m4a = insertMilestone(p4, 'Schema migration', 'All tables migrated', daysFromNow(-20), 'completed');
  const m4b = insertMilestone(p4, 'Cutover', 'Switch traffic to Postgres', daysFromNow(8), 'open');
  const t23 = insertTask({ project_id: p4, title: 'Map MySQL schema to Postgres', status: 'done', priority: 'high', due_date: daysFromNow(-55), assignee_id: dev, reporter_id: viki, labels: 'backend', milestone_id: m4a, estimated_hours: 16, time_spent: 15 });
  const t24 = insertTask({ project_id: p4, title: 'Build ETL pipeline for core tables', status: 'done', priority: 'high', due_date: daysFromNow(-30), assignee_id: dev, reporter_id: viki, labels: 'backend', milestone_id: m4a, estimated_hours: 40, time_spent: 38 });
  const t25 = insertTask({ project_id: p4, title: 'Validate data integrity (row counts, checksums)', status: 'done', priority: 'high', due_date: daysFromNow(-12), assignee_id: dev, reporter_id: viki, labels: 'qa', milestone_id: m4a, estimated_hours: 20, time_spent: 18 });
  const t26 = insertTask({ project_id: p4, title: 'Set up replication & sync', status: 'in_progress', priority: 'high', due_date: daysFromNow(3), assignee_id: dev, reporter_id: viki, labels: 'infra', milestone_id: m4b, estimated_hours: 16, time_spent: 6 });
  const t27 = insertTask({ project_id: p4, title: 'Run parallel-read validation', status: 'in_progress', priority: 'medium', due_date: daysFromNow(5), assignee_id: dev, reporter_id: viki, labels: 'qa', milestone_id: m4b, estimated_hours: 12, time_spent: 3 });
  const t28 = insertTask({ project_id: p4, title: 'Execute cutover & rollback plan', status: 'todo', priority: 'high', due_date: daysFromNow(8), assignee_id: viki, reporter_id: viki, labels: 'infra', milestone_id: m4b, estimated_hours: 8 });
  insertDependency(t26, t25);
  insertDependency(t27, t26);
  insertDependency(t28, t27);
  insertChecklist(t26, ['Configure logical replication', 'Monitor lag', 'Set up failover']);
  insertComment(t26, dev, 'Replication lag is stable at <1s.');
  insertTimeEntry(t26, dev, 360, 'Replication setup');
  insertWatcher(t26, viki);

  // ============ 5. Marketing Campaign — Q3 ============
  const p5 = insertProject({
    name: 'Marketing Campaign — Q3',
    description: 'Multi-channel campaign: email, social, paid ads, and a launch webinar.',
    color: '#ec4899', status: 'active', priority: 'medium', progress: 50,
    start_date: daysFromNow(-25), due_date: daysFromNow(25), owner_id: pm,
    tags: 'marketing'
  });
  const m5a = insertMilestone(p5, 'Campaign launch', 'All channels live', daysFromNow(5), 'open');
  const t29 = insertTask({ project_id: p5, title: 'Define target audience & personas', status: 'done', priority: 'high', due_date: daysFromNow(-20), assignee_id: pm, reporter_id: viki, labels: 'research', estimated_hours: 8, time_spent: 7 });
  const t30 = insertTask({ project_id: p5, title: 'Write email sequence (5 emails)', status: 'done', priority: 'high', due_date: daysFromNow(-10), assignee_id: pm, reporter_id: viki, labels: 'content', estimated_hours: 12, time_spent: 11 });
  const t31 = insertTask({ project_id: p5, title: 'Design social media creatives', status: 'in_progress', priority: 'medium', due_date: daysFromNow(2), assignee_id: designer, reporter_id: pm, labels: 'design', estimated_hours: 16, time_spent: 9 });
  const t32 = insertTask({ project_id: p5, title: 'Set up paid ad campaigns', status: 'in_progress', priority: 'medium', due_date: daysFromNow(4), assignee_id: pm, reporter_id: viki, labels: 'ads', estimated_hours: 10, time_spent: 4 });
  const t33 = insertTask({ project_id: p5, title: 'Plan & promote launch webinar', status: 'todo', priority: 'medium', due_date: daysFromNow(12), assignee_id: pm, reporter_id: viki, labels: 'events', estimated_hours: 14 });
  const t34 = insertTask({ project_id: p5, title: 'Track & report campaign KPIs', status: 'todo', priority: 'low', due_date: daysFromNow(25), assignee_id: pm, reporter_id: viki, labels: 'analytics', estimated_hours: 8 });
  insertDependency(t31, t30);
  insertDependency(t32, t29);
  insertDependency(t33, t31);
  insertChecklist(t32, ['Create ad sets', 'Set budgets', 'Add tracking pixels']);
  insertComment(t32, pm, 'Budget approved, launching tomorrow.');
  insertTimeEntry(t32, pm, 240, 'Ad setup');
  insertWatcher(t32, viki);

  // ============ 6. Internal Tooling — Admin Dashboard ============
  const p6 = insertProject({
    name: 'Internal Admin Dashboard',
    description: 'Internal tool for support and ops teams to manage users, orders, and refunds.',
    color: '#8b5cf6', status: 'active', priority: 'medium', progress: 20,
    start_date: daysFromNow(-10), due_date: daysFromNow(50), owner_id: dev,
    tags: 'internal,frontend'
  });
  const s6a = insertSprint(p6, 'Sprint 1 — Scaffold', 'Layout, auth, nav', daysFromNow(-10), daysFromNow(4), 'active');
  const t35 = insertTask({ project_id: p6, title: 'Set up admin layout & navigation', status: 'in_progress', priority: 'high', due_date: daysFromNow(3), assignee_id: dev, reporter_id: viki, labels: 'frontend', sprint_id: s6a, estimated_hours: 12, time_spent: 5 });
  const t36 = insertTask({ project_id: p6, title: 'User management table', status: 'todo', priority: 'high', due_date: daysFromNow(10), assignee_id: dev, reporter_id: viki, labels: 'frontend', sprint_id: s6a, estimated_hours: 16 });
  const t37 = insertTask({ project_id: p6, title: 'Order & refund management', status: 'todo', priority: 'medium', due_date: daysFromNow(18), assignee_id: dev, reporter_id: viki, labels: 'frontend', estimated_hours: 20 });
  const t38 = insertTask({ project_id: p6, title: 'Role-based access control', status: 'todo', priority: 'high', due_date: daysFromNow(25), assignee_id: dev, reporter_id: viki, labels: 'backend', estimated_hours: 12 });
  insertDependency(t36, t35);
  insertDependency(t37, t36);
  insertDependency(t38, t35);
  insertChecklist(t35, ['Sidebar nav', 'Topbar', 'Route guards']);
  insertComment(t35, dev, 'Layout is coming together nicely.');
  insertTimeEntry(t35, dev, 300, 'Layout build');
  insertWatcher(t35, viki);

  // ============ 7. Security Audit & Hardening ============
  const p7 = insertProject({
    name: 'Security Audit & Hardening',
    description: 'Third-party penetration test, dependency audit, and infrastructure hardening.',
    color: '#f43f5e', status: 'active', priority: 'high', progress: 15,
    start_date: daysFromNow(-5), due_date: daysFromNow(35), owner_id: viki,
    tags: 'security,infra'
  });
  const m7a = insertMilestone(p7, 'Pen test complete', 'Report delivered', daysFromNow(20), 'open');
  const t39 = insertTask({ project_id: p7, title: 'Run dependency vulnerability scan', status: 'in_progress', priority: 'high', due_date: daysFromNow(3), assignee_id: dev, reporter_id: viki, labels: 'security', estimated_hours: 6, time_spent: 2 });
  const t40 = insertTask({ project_id: p7, title: 'Schedule external penetration test', status: 'done', priority: 'high', due_date: daysFromNow(-2), assignee_id: viki, reporter_id: viki, labels: 'security', estimated_hours: 2, time_spent: 1 });
  const t41 = insertTask({ project_id: p7, title: 'Harden server & network config', status: 'todo', priority: 'high', due_date: daysFromNow(10), assignee_id: dev, reporter_id: viki, labels: 'infra', estimated_hours: 16 });
  const t42 = insertTask({ project_id: p7, title: 'Review & rotate all API keys', status: 'todo', priority: 'high', due_date: daysFromNow(15), assignee_id: viki, reporter_id: viki, labels: 'security', estimated_hours: 4 });
  const t43 = insertTask({ project_id: p7, title: 'Implement audit logging for admin actions', status: 'todo', priority: 'medium', due_date: daysFromNow(25), assignee_id: dev, reporter_id: viki, labels: 'backend', estimated_hours: 12 });
  insertDependency(t41, t39);
  insertDependency(t42, t40);
  insertChecklist(t41, ['Disable unused ports', 'Set up fail2ban', 'Enable 2FA on admin']);
  insertComment(t41, dev, 'Waiting on pen test results before final hardening.');
  insertTimeEntry(t39, dev, 120, 'Vuln scan');
  insertWatcher(t41, viki);

  // ============ 8. Customer Support Portal ============
  const p8 = insertProject({
    name: 'Customer Support Portal',
    description: 'Self-service help center with knowledge base, ticket submission, and live chat.',
    color: '#06b6d4', status: 'active', priority: 'medium', progress: 35,
    start_date: daysFromNow(-15), due_date: daysFromNow(45), owner_id: pm,
    tags: 'product,frontend'
  });
  const m8a = insertMilestone(p8, 'Knowledge base live', 'Articles published', daysFromNow(15), 'open');
  const s8a = insertSprint(p8, 'Sprint 1 — KB', 'Article system', daysFromNow(-15), daysFromNow(-1), 'completed');
  const s8b = insertSprint(p8, 'Sprint 2 — Tickets', 'Ticket flow', daysFromNow(0), daysFromNow(14), 'active');
  const t44 = insertTask({ project_id: p8, title: 'Design knowledge base structure', status: 'done', priority: 'high', due_date: daysFromNow(-12), assignee_id: designer, reporter_id: pm, labels: 'design', sprint_id: s8a, milestone_id: m8a, estimated_hours: 10, time_spent: 9 });
  const t45 = insertTask({ project_id: p8, title: 'Build article editor & publishing', status: 'done', priority: 'high', due_date: daysFromNow(-3), assignee_id: dev, reporter_id: pm, labels: 'backend', sprint_id: s8a, milestone_id: m8a, estimated_hours: 20, time_spent: 18 });
  const t46 = insertTask({ project_id: p8, title: 'Write 20 help center articles', status: 'in_progress', priority: 'medium', due_date: daysFromNow(10), assignee_id: pm, reporter_id: viki, labels: 'content', sprint_id: s8b, milestone_id: m8a, estimated_hours: 20, time_spent: 6 });
  const t47 = insertTask({ project_id: p8, title: 'Build ticket submission form', status: 'in_progress', priority: 'high', due_date: daysFromNow(8), assignee_id: dev, reporter_id: pm, labels: 'frontend', sprint_id: s8b, estimated_hours: 12, time_spent: 4 });
  const t48 = insertTask({ project_id: p8, title: 'Integrate live chat widget', status: 'todo', priority: 'medium', due_date: daysFromNow(20), assignee_id: dev, reporter_id: pm, labels: 'frontend', estimated_hours: 16 });
  const t49 = insertTask({ project_id: p8, title: 'Set up ticket routing & SLA', status: 'todo', priority: 'medium', due_date: daysFromNow(30), assignee_id: dev, reporter_id: pm, labels: 'backend', estimated_hours: 12 });
  insertDependency(t47, t45);
  insertDependency(t48, t47);
  insertDependency(t49, t47);
  insertChecklist(t47, ['Form fields', 'Validation', 'Attachment upload', 'Confirmation email']);
  insertComment(t47, dev, 'Form is done, adding attachment upload next.');
  insertTimeEntry(t47, dev, 240, 'Ticket form');
  insertWatcher(t47, pm);

  // ============ 9. Infrastructure — Kubernetes Migration ============
  const p9 = insertProject({
    name: 'Kubernetes Migration',
    description: 'Move services from Docker Compose to a managed Kubernetes cluster.',
    color: '#3b82f6', status: 'active', priority: 'high', progress: 10,
    start_date: daysFromNow(-7), due_date: daysFromNow(60), owner_id: viki,
    tags: 'infra,backend'
  });
  const m9a = insertMilestone(p9, 'Cluster provisioned', 'EKS cluster ready', daysFromNow(15), 'open');
  const t50 = insertTask({ project_id: p9, title: 'Provision EKS cluster & networking', status: 'in_progress', priority: 'high', due_date: daysFromNow(10), assignee_id: dev, reporter_id: viki, labels: 'infra', milestone_id: m9a, estimated_hours: 24, time_spent: 6 });
  const t51 = insertTask({ project_id: p9, title: 'Containerize all services with Helm', status: 'todo', priority: 'high', due_date: daysFromNow(20), assignee_id: dev, reporter_id: viki, labels: 'infra', milestone_id: m9a, estimated_hours: 30 });
  const t52 = insertTask({ project_id: p9, title: 'Set up CI/CD for K8s deployments', status: 'todo', priority: 'high', due_date: daysFromNow(30), assignee_id: dev, reporter_id: viki, labels: 'devops', estimated_hours: 20 });
  const t53 = insertTask({ project_id: p9, title: 'Configure monitoring & alerting', status: 'todo', priority: 'medium', due_date: daysFromNow(40), assignee_id: dev, reporter_id: viki, labels: 'devops', estimated_hours: 16 });
  const t54 = insertTask({ project_id: p9, title: 'Migrate databases & stateful services', status: 'todo', priority: 'high', due_date: daysFromNow(50), assignee_id: dev, reporter_id: viki, labels: 'infra', estimated_hours: 24 });
  insertDependency(t51, t50);
  insertDependency(t52, t51);
  insertDependency(t54, t52);
  insertChecklist(t50, ['Create VPC', 'Provision node groups', 'Set up ingress controller']);
  insertComment(t50, dev, 'Cluster is up, working on ingress now.');
  insertTimeEntry(t50, dev, 360, 'Cluster setup');
  insertWatcher(t50, viki);

  // ============ 10. Product Analytics Integration ============
  const p10 = insertProject({
    name: 'Product Analytics Integration',
    description: 'Instrument the product with event tracking and build a usage dashboard.',
    color: '#14b8a6', status: 'active', priority: 'medium', progress: 5,
    start_date: daysFromNow(-3), due_date: daysFromNow(40), owner_id: pm,
    tags: 'analytics,product'
  });
  const t55 = insertTask({ project_id: p10, title: 'Define event taxonomy & tracking plan', status: 'in_progress', priority: 'high', due_date: daysFromNow(5), assignee_id: pm, reporter_id: viki, labels: 'research', estimated_hours: 10, time_spent: 3 });
  const t56 = insertTask({ project_id: p10, title: 'Instrument frontend events', status: 'todo', priority: 'high', due_date: daysFromNow(15), assignee_id: dev, reporter_id: pm, labels: 'frontend', estimated_hours: 16 });
  const t57 = insertTask({ project_id: p10, title: 'Instrument backend events', status: 'todo', priority: 'medium', due_date: daysFromNow(20), assignee_id: dev, reporter_id: pm, labels: 'backend', estimated_hours: 12 });
  const t58 = insertTask({ project_id: p10, title: 'Build usage analytics dashboard', status: 'todo', priority: 'medium', due_date: daysFromNow(30), assignee_id: dev, reporter_id: pm, labels: 'frontend', estimated_hours: 20 });
  const t59 = insertTask({ project_id: p10, title: 'Set up weekly analytics report', status: 'todo', priority: 'low', due_date: daysFromNow(38), assignee_id: pm, reporter_id: viki, labels: 'analytics', estimated_hours: 6 });
  insertDependency(t56, t55);
  insertDependency(t57, t55);
  insertDependency(t58, t56);
  insertChecklist(t55, ['List key user journeys', 'Define event names', 'Get team sign-off']);
  insertComment(t55, pm, 'Taxonomy draft is ready for review.');
  insertTimeEntry(t55, pm, 180, 'Taxonomy');
  insertWatcher(t55, viki);

  // ============ 11. Documentation Overhaul ============
  const p11 = insertProject({
    name: 'Documentation Overhaul',
    description: 'Rewrite and reorganize all product documentation with a new docs site.',
    color: '#a855f7', status: 'active', priority: 'low', progress: 40,
    start_date: daysFromNow(-20), due_date: daysFromNow(30), owner_id: pm,
    tags: 'docs,content'
  });
  const t60 = insertTask({ project_id: p11, title: 'Audit existing documentation', status: 'done', priority: 'medium', due_date: daysFromNow(-15), assignee_id: pm, reporter_id: viki, labels: 'research', estimated_hours: 8, time_spent: 7 });
  const t61 = insertTask({ project_id: p11, title: 'Set up docs site (Docusaurus)', status: 'done', priority: 'medium', due_date: daysFromNow(-8), assignee_id: dev, reporter_id: pm, labels: 'frontend', estimated_hours: 10, time_spent: 9 });
  const t62 = insertTask({ project_id: p11, title: 'Write getting-started guide', status: 'in_progress', priority: 'high', due_date: daysFromNow(5), assignee_id: pm, reporter_id: viki, labels: 'content', estimated_hours: 12, time_spent: 5 });
  const t63 = insertTask({ project_id: p11, title: 'Write API reference', status: 'todo', priority: 'medium', due_date: daysFromNow(15), assignee_id: dev, reporter_id: pm, labels: 'docs', estimated_hours: 20 });
  const t64 = insertTask({ project_id: p11, title: 'Add search & versioning to docs', status: 'todo', priority: 'low', due_date: daysFromNow(25), assignee_id: dev, reporter_id: pm, labels: 'frontend', estimated_hours: 12 });
  insertDependency(t62, t61);
  insertDependency(t63, t61);
  insertChecklist(t62, ['Outline', 'Draft sections', 'Add code samples', 'Review']);
  insertComment(t62, pm, 'First draft is up, feedback welcome.');
  insertTimeEntry(t62, pm, 300, 'Getting started guide');
  insertWatcher(t62, viki);

  // ============ 12. Legacy System Decommission ============
  const p12 = insertProject({
    name: 'Legacy System Decommission',
    description: 'Retire the legacy monolith and archive its data after full migration.',
    color: '#64748b', status: 'active', priority: 'low', progress: 70,
    start_date: daysFromNow(-50), due_date: daysFromNow(15), owner_id: viki,
    tags: 'infra,backend'
  });
  const m12a = insertMilestone(p12, 'Data archived', 'All data backed up', daysFromNow(-5), 'completed');
  const m12b = insertMilestone(p12, 'System retired', 'Legacy shut down', daysFromNow(12), 'open');
  const t65 = insertTask({ project_id: p12, title: 'Archive all legacy data', status: 'done', priority: 'high', due_date: daysFromNow(-10), assignee_id: dev, reporter_id: viki, labels: 'infra', milestone_id: m12a, estimated_hours: 16, time_spent: 15 });
  const t66 = insertTask({ project_id: p12, title: 'Verify no active dependencies on legacy', status: 'done', priority: 'high', due_date: daysFromNow(-3), assignee_id: dev, reporter_id: viki, labels: 'qa', milestone_id: m12a, estimated_hours: 8, time_spent: 7 });
  const t67 = insertTask({ project_id: p12, title: 'Shut down legacy servers', status: 'in_progress', priority: 'high', due_date: daysFromNow(5), assignee_id: dev, reporter_id: viki, labels: 'infra', milestone_id: m12b, estimated_hours: 6, time_spent: 2 });
  const t68 = insertTask({ project_id: p12, title: 'Update DNS & redirects', status: 'todo', priority: 'medium', due_date: daysFromNow(8), assignee_id: dev, reporter_id: viki, labels: 'infra', milestone_id: m12b, estimated_hours: 4 });
  const t69 = insertTask({ project_id: p12, title: 'Document decommission & lessons learned', status: 'todo', priority: 'low', due_date: daysFromNow(12), assignee_id: viki, reporter_id: viki, labels: 'docs', milestone_id: m12b, estimated_hours: 4 });
  insertDependency(t67, t66);
  insertDependency(t68, t67);
  insertDependency(t69, t68);
  insertChecklist(t67, ['Stop app servers', 'Stop DB', 'Remove from load balancer']);
  insertComment(t67, dev, 'App servers stopped, DB shutdown next.');
  insertTimeEntry(t67, dev, 120, 'Shutdown');
  insertWatcher(t67, viki);

  // ============ 13. Onboarding Experience Redesign ============
  const p13 = insertProject({
    name: 'Onboarding Experience Redesign',
    description: 'Improve new-user activation with a guided onboarding flow and in-app tips.',
    color: '#f97316', status: 'active', priority: 'medium', progress: 25,
    start_date: daysFromNow(-12), due_date: daysFromNow(35), owner_id: pm,
    tags: 'product,design'
  });
  const s13a = insertSprint(p13, 'Sprint 1 — Research', 'User interviews, funnel analysis', daysFromNow(-12), daysFromNow(2), 'active');
  const t70 = insertTask({ project_id: p13, title: 'Analyze onboarding funnel drop-off', status: 'in_progress', priority: 'high', due_date: daysFromNow(2), assignee_id: pm, reporter_id: viki, labels: 'analytics', sprint_id: s13a, estimated_hours: 10, time_spent: 6 });
  const t71 = insertTask({ project_id: p13, title: 'Conduct user interviews (5 users)', status: 'todo', priority: 'high', due_date: daysFromNow(8), assignee_id: pm, reporter_id: viki, labels: 'research', sprint_id: s13a, estimated_hours: 12 });
  const t72 = insertTask({ project_id: p13, title: 'Design guided onboarding flow', status: 'todo', priority: 'high', due_date: daysFromNow(15), assignee_id: designer, reporter_id: pm, labels: 'design', estimated_hours: 20 });
  const t73 = insertTask({ project_id: p13, title: 'Build in-app tips & tooltips', status: 'todo', priority: 'medium', due_date: daysFromNow(25), assignee_id: dev, reporter_id: pm, labels: 'frontend', estimated_hours: 16 });
  const t74 = insertTask({ project_id: p13, title: 'A/B test new onboarding', status: 'todo', priority: 'medium', due_date: daysFromNow(32), assignee_id: dev, reporter_id: pm, labels: 'analytics', estimated_hours: 12 });
  insertDependency(t71, t70);
  insertDependency(t72, t71);
  insertDependency(t73, t72);
  insertDependency(t74, t73);
  insertChecklist(t70, ['Export funnel data', 'Identify drop-off points', 'Summarize findings']);
  insertComment(t70, pm, 'Big drop-off at step 3, will dig in.');
  insertTimeEntry(t70, pm, 360, 'Funnel analysis');
  insertWatcher(t70, viki);

  // ============ 14. Partner Integrations Program ============
  const p14 = insertProject({
    name: 'Partner Integrations Program',
    description: 'Build and document integrations with key partners (Slack, Zapier, HubSpot).',
    color: '#22c55e', status: 'active', priority: 'medium', progress: 15,
    start_date: daysFromNow(-8), due_date: daysFromNow(55), owner_id: dev,
    tags: 'api,partners'
  });
  const m14a = insertMilestone(p14, 'Slack integration live', 'Slack app published', daysFromNow(20), 'open');
  const t75 = insertTask({ project_id: p14, title: 'Build Slack integration', status: 'in_progress', priority: 'high', due_date: daysFromNow(15), assignee_id: dev, reporter_id: viki, labels: 'backend', milestone_id: m14a, estimated_hours: 24, time_spent: 8 });
  const t76 = insertTask({ project_id: p14, title: 'Build Zapier integration', status: 'todo', priority: 'high', due_date: daysFromNow(25), assignee_id: dev, reporter_id: viki, labels: 'backend', estimated_hours: 20 });
  const t77 = insertTask({ project_id: p14, title: 'Build HubSpot integration', status: 'todo', priority: 'medium', due_date: daysFromNow(35), assignee_id: dev, reporter_id: viki, labels: 'backend', estimated_hours: 20 });
  const t78 = insertTask({ project_id: p14, title: 'Write partner integration docs', status: 'todo', priority: 'low', due_date: daysFromNow(45), assignee_id: pm, reporter_id: viki, labels: 'docs', estimated_hours: 10 });
  const t79 = insertTask({ project_id: p14, title: 'Publish to partner marketplaces', status: 'todo', priority: 'medium', due_date: daysFromNow(50), assignee_id: viki, reporter_id: viki, labels: 'release', estimated_hours: 6 });
  insertDependency(t76, t75);
  insertDependency(t77, t75);
  insertDependency(t78, t76);
  insertChecklist(t75, ['OAuth flow', 'Event subscription', 'Slack app manifest', 'Publish']);
  insertComment(t75, dev, 'OAuth is working, wiring up events now.');
  insertTimeEntry(t75, dev, 480, 'Slack integration');
  insertWatcher(t75, viki);

  // ============ 15. Performance Optimization ============
  const p15 = insertProject({
    name: 'Performance Optimization',
    description: 'Improve app load times, database query performance, and reduce infrastructure cost.',
    color: '#eab308', status: 'active', priority: 'medium', progress: 30,
    start_date: daysFromNow(-15), due_date: daysFromNow(30), owner_id: dev,
    tags: 'backend,infra'
  });
  const m15a = insertMilestone(p15, 'Load time < 2s', 'P95 load under 2s', daysFromNow(20), 'open');
  const t80 = insertTask({ project_id: p15, title: 'Profile & identify slow queries', status: 'done', priority: 'high', due_date: daysFromNow(-10), assignee_id: dev, reporter_id: viki, labels: 'backend', milestone_id: m15a, estimated_hours: 12, time_spent: 11 });
  const t81 = insertTask({ project_id: p15, title: 'Add database indexes for hot queries', status: 'in_progress', priority: 'high', due_date: daysFromNow(5), assignee_id: dev, reporter_id: viki, labels: 'backend', milestone_id: m15a, estimated_hours: 10, time_spent: 4 });
  const t82 = insertTask({ project_id: p15, title: 'Implement caching layer (Redis)', status: 'todo', priority: 'high', due_date: daysFromNow(12), assignee_id: dev, reporter_id: viki, labels: 'backend', milestone_id: m15a, estimated_hours: 16 });
  const t83 = insertTask({ project_id: p15, title: 'Optimize frontend bundle size', status: 'todo', priority: 'medium', due_date: daysFromNow(18), assignee_id: dev, reporter_id: viki, labels: 'frontend', estimated_hours: 12 });
  const t84 = insertTask({ project_id: p15, title: 'Load test & tune infrastructure', status: 'todo', priority: 'medium', due_date: daysFromNow(25), assignee_id: dev, reporter_id: viki, labels: 'infra', estimated_hours: 14 });
  insertDependency(t81, t80);
  insertDependency(t82, t81);
  insertDependency(t83, t80);
  insertChecklist(t81, ['Identify hot queries', 'Add indexes', 'Verify with EXPLAIN']);
  insertComment(t81, dev, 'Indexes added, query time down 60%.');
  insertTimeEntry(t81, dev, 240, 'Index optimization');
  insertWatcher(t81, viki);

  console.log(`\nDemo seed complete. Added 15 projects with tasks, sprints, milestones, comments, labels, tags, dependencies, checklists, time entries, watchers, and notifications.`);
});

seed();

// ---------- Skills catalog + user skills (idempotent) ----------
const skillDefs = [
  ['React', 'Frontend', ''],
  ['TypeScript', 'Frontend', ''],
  ['CSS / Tailwind', 'Frontend', ''],
  ['Node.js', 'Backend', ''],
  ['SQL', 'Backend', ''],
  ['PostgreSQL', 'Backend', ''],
  ['Docker', 'DevOps', ''],
  ['Kubernetes', 'DevOps', ''],
  ['Terraform', 'DevOps', ''],
  ['Python', 'Data', ''],
  ['Data Analysis', 'Data', ''],
  ['Machine Learning', 'AI', ''],
  ['Prompt Engineering', 'AI', ''],
  ['Figma', 'Design', ''],
  ['UX Research', 'Design', '']
];

const skillIds = {};
for (const [name, category, description] of skillDefs) {
  skillIds[name] = upsertSkill(name, category, description);
}

const userSkillDefs = [
  [dev, 'React', 'Advanced', 6],
  [dev, 'TypeScript', 'Advanced', 5],
  [dev, 'Node.js', 'Advanced', 7],
  [dev, 'SQL', 'Intermediate', 4],
  [dev, 'Docker', 'Intermediate', 3],
  [dev, 'Kubernetes', 'Beginner', 1],
  [pm, 'SQL', 'Intermediate', 3],
  [pm, 'Data Analysis', 'Advanced', 5],
  [pm, 'Prompt Engineering', 'Intermediate', 1],
  [designer, 'Figma', 'Expert', 8],
  [designer, 'UX Research', 'Advanced', 6],
  [designer, 'CSS / Tailwind', 'Intermediate', 3],
  [viki, 'React', 'Intermediate', 2],
  [viki, 'Terraform', 'Beginner', 1],
  [viki, 'Machine Learning', 'Beginner', 1]
];

for (const [userId, skillName, level, years] of userSkillDefs) {
  upsertUserSkill(userId, skillIds[skillName], level, years);
}

console.log(`Seeded ${skillDefs.length} skills and ${userSkillDefs.length} user-skill assignments.`);

// Summary
const projCount = db.prepare('SELECT COUNT(*) c FROM projects WHERE deleted_at IS NULL').get().c;
const taskCount = db.prepare('SELECT COUNT(*) c FROM tasks WHERE deleted_at IS NULL').get().c;
const sprintCount = db.prepare('SELECT COUNT(*) c FROM sprints').get().c;
const milestoneCount = db.prepare('SELECT COUNT(*) c FROM milestones').get().c;
console.log(`\nTotals now: ${projCount} projects, ${taskCount} tasks, ${sprintCount} sprints, ${milestoneCount} milestones.`);
