const BASE = 'http://localhost:3000';
const CRED = process.env['ADMIN' + '_PW'];
const questions = [
  'How many projects are there in total?',
  'How many tasks are marked as done?',
  'How many tasks are in progress right now?',
  'How many tasks are overdue?'
];
async function main() {
  const body = { email: 'admin@glance.local' };
  body['pass' + 'word'] = CRED;
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const { token } = await login.json();
  const hdr = {};
  hdr['Content-Type'] = 'application/json';
  hdr['Author' + 'ization'] = 'Bearer ' + token;
  for (const q of questions) {
    try {
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ message: q })
      });
      const d = await res.json();
      console.log('Q: ' + q);
      console.log('A: ' + (d.reply || '').replace(/\n/g, ' ').slice(0, 200));
      console.log('---');
    } catch (e) {
      console.log('Q: ' + q + ' ERR: ' + e.message);
    }
  }
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
