import Database from 'better-sqlite3';
const db = new Database('/data/glance.db');
db.pragma('foreign_keys = ON');

function addPortfolio(name, color) {
  return db.prepare('INSERT INTO portfolios (name, color) VALUES (?, ?)').run(name, color).lastInsertRowid;
}
function addProgram(portfolio_id, name, color) {
  return db.prepare('INSERT INTO programs (name, portfolio_id, color) VALUES (?, ?, ?)').run(name, portfolio_id, color).lastInsertRowid;
}
function assign(projectName, program_id, portfolio_id) {
  const p = db.prepare('SELECT id FROM projects WHERE name = ? AND deleted_at IS NULL').get(projectName);
  if (!p) { console.log('  ! project not found:', projectName); return; }
  db.prepare('UPDATE projects SET program_id = ?, portfolio_id = ? WHERE id = ?').run(program_id, portfolio_id, p.id);
  console.log('  assigned:', projectName);
}

const seed = db.transaction(() => {
  console.log('Creating portfolios & programs, distributing projects...');

  // Portfolio 1: Product & Customer
  const p1 = addPortfolio('Product & Customer', '#00e5ff');
  const m1 = addProgram(p1, 'Mobile & Onboarding', '#06b6d4');
  const cx = addProgram(p1, 'Customer Experience', '#8b5cf6');
  assign('Mobile App Launch', m1, p1);
  assign('Product Analytics Integration', m1, p1);
  assign('Onboarding Experience Redesign', m1, p1);
  assign('Customer Support Portal', cx, p1);
  assign('Website Redesign', cx, p1);

  // Portfolio 2: Engineering & Infrastructure
  const p2 = addPortfolio('Engineering & Infrastructure', '#10b981');
  const plat = addProgram(p2, 'Platform & APIs', '#3b82f6');
  const infra = addProgram(p2, 'Infrastructure & Migration', '#22c55e');
  assign('API Platform v2', plat, p2);
  assign('Internal Admin Dashboard', plat, p2);
  assign('Data Migration to Postgres', infra, p2);
  assign('Kubernetes Migration', infra, p2);
  assign('Legacy System Decommission', infra, p2);
  assign('Performance Optimization', infra, p2);

  // Portfolio 3: Business Enablement
  const p3 = addPortfolio('Business Enablement', '#ec4899');
  const mkt = addProgram(p3, 'Marketing & Growth', '#f59e0b');
  const part = addProgram(p3, 'Partnerships & Content', '#f97316');
  assign('Marketing Campaign — Q3', mkt, p3);
  assign('Partner Integrations Program', part, p3);
  assign('Documentation Overhaul', part, p3);

  // Portfolio 4: Security & Compliance (direct portfolio project)
  const p4 = addPortfolio('Security & Compliance', '#f43f5e');
  assign('Security Audit & Hardening', null, p4);

  // Real project: ServiceNow ITSM (kept separate — real work)
  const p5 = addPortfolio('ServiceNow ITSM', '#6366f1');
  assign('ServiceNow upgrade to Australia version', null, p5);
});

seed();

console.log('\nSummary:');
console.log('portfolios:', db.prepare('SELECT COUNT(*) c FROM portfolios WHERE deleted_at IS NULL').get().c);
console.log('programs:', db.prepare('SELECT COUNT(*) c FROM programs WHERE deleted_at IS NULL').get().c);
console.log('projects with program:', db.prepare('SELECT COUNT(*) c FROM projects WHERE deleted_at IS NULL AND program_id IS NOT NULL').get().c);
console.log('projects with portfolio (no program):', db.prepare('SELECT COUNT(*) c FROM projects WHERE deleted_at IS NULL AND portfolio_id IS NOT NULL AND program_id IS NULL').get().c);
console.log('unassigned:', db.prepare('SELECT COUNT(*) c FROM projects WHERE deleted_at IS NULL AND program_id IS NULL AND portfolio_id IS NULL').get().c);
