import bcrypt from 'bcryptjs';
import db from './db.js';

export function seed() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@glance.local');
  if (existing) return;

  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
    'admin@glance.local',
    hash,
    'Admin',
    'admin'
  );
  console.log('Seeded default admin user: admin@glance.local / admin123');
}
